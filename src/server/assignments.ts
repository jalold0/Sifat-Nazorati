/**
 * Vazifa biriktirilishi — qayta biriktirish va tarix.
 *
 * Qoida: o'tgan ish qayta yozilmaydi. Mas'ul almashtirilganda joriy oraliq
 * yopiladi, yangisi ochiladi; murojaatlar esa o'z mas'ulini saqlab qoladi
 * (`Ticket.ownerId` yaratilganda yozilgan). Shuning uchun o'tgan oyning KPI si
 * va hisoboti o'zgarmaydi.
 */

import 'server-only';

import {
  countByAssignment,
  currentWindow,
  validateReassign,
  type AssignmentWindow,
} from '@/domain/assignment';
import {
  canDeleteTask,
  nextTaskNo,
  validateAssignee,
  validateTaskInput,
  type Kind,
  type Priority,
  type TaskInput,
} from '@/domain/task';
import { db } from '@/lib/db';

import { logActivity } from './shared';

const WINDOW_SELECT = {
  id: true,
  ownerId: true,
  backupId: true,
  from: true,
  until: true,
  reason: true,
  createdAt: true,
  owner: { select: { shortName: true } },
  backup: { select: { shortName: true } },
  changedBy: { select: { shortName: true } },
} as const;

export interface AssignmentRow {
  id: number;
  ownerId: string;
  ownerName: string;
  backupId: string | null;
  backupName: string | null;
  from: Date;
  until: Date | null;
  reason: string | null;
  changedByName: string | null;
  /** Shu oraliqda qayd etilgan murojaat soni */
  ticketCount: number;
}

export interface TaskWithAssignments {
  id: number;
  no: number;
  zoneCode: string;
  zoneName: string;
  title: string;
  source: string;
  frequency: string;
  slaHours: number | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  kind: 'PROACTIVE' | 'REACTIVE';
  active: boolean;
  currentOwnerId: string;
  currentOwnerName: string;
  currentBackupId: string | null;
  currentBackupName: string | null;
  /** Joriy biriktirish qachondan buyon amalda */
  currentSince: Date | null;
  history: AssignmentRow[];
  /** Hech bir oraliqqa tushmagan murojaatlar — bo'lsa, ma'lumot nomutanosib */
  unassignedTickets: number;
}

/** Bitta vazifa: joriy holat + to'liq tarix + har oraliqdagi murojaat soni. */
export async function taskWithHistory(no: number): Promise<TaskWithAssignments | null> {
  const task = await db.taskDef.findUnique({
    where: { no },
    include: {
      zone: { select: { name: true } },
      owner: { select: { id: true, shortName: true } },
      backup: { select: { id: true, shortName: true } },
      assignments: { select: WINDOW_SELECT, orderBy: { from: 'asc' } },
    },
  });
  if (!task) return null;

  const tickets = await db.ticket.findMany({
    where: { taskDefId: task.id, status: { not: 'CANCELLED' } },
    select: { date: true },
  });

  const windows: AssignmentWindow[] = task.assignments.map((a) => ({
    id: a.id,
    ownerId: a.ownerId,
    backupId: a.backupId,
    from: a.from,
    until: a.until,
  }));

  const { rows, unassigned } = countByAssignment(
    windows,
    tickets.map((t) => t.date),
  );
  const countMap = new Map(rows.map((r) => [r.windowId, r.count]));
  const current = currentWindow(windows);

  return {
    id: task.id,
    no: task.no,
    zoneCode: task.zoneCode,
    zoneName: task.zone.name,
    title: task.title,
    source: task.source,
    frequency: task.frequency,
    slaHours: task.slaHours,
    priority: task.priority,
    kind: task.kind,
    active: task.active,
    currentOwnerId: task.owner.id,
    currentOwnerName: task.owner.shortName,
    currentBackupId: task.backup?.id ?? null,
    currentBackupName: task.backup?.shortName ?? null,
    currentSince: current?.from ?? null,
    unassignedTickets: unassigned,
    history: task.assignments.map((a) => ({
      id: a.id,
      ownerId: a.ownerId,
      ownerName: a.owner.shortName,
      backupId: a.backupId,
      backupName: a.backup?.shortName ?? null,
      from: a.from,
      until: a.until,
      reason: a.reason,
      changedByName: a.changedBy?.shortName ?? null,
      ticketCount: countMap.get(a.id) ?? 0,
    })),
  };
}

export interface ReassignResult {
  ok: boolean;
  error?: string;
  summary?: string;
}

/**
 * Mas'ul va/yoki zaxirani almashtiradi.
 *
 * Bitta tranzaksiyada: joriy oraliq yopiladi → yangisi ochiladi →
 * `TaskDef` dagi joriy ko'rsatkich yangilanadi. Uchtasi birga bajariladi,
 * aks holda vazifa "mas'ulsiz" holatda qolib ketishi mumkin.
 */
export async function reassignTask(input: {
  taskNo: number;
  newOwnerId: string;
  newBackupId: string | null;
  reason: string | null;
  effectiveFrom: Date;
  actorId: string;
}): Promise<ReassignResult> {
  const task = await db.taskDef.findUnique({
    where: { no: input.taskNo },
    select: {
      id: true,
      no: true,
      title: true,
      ownerId: true,
      backupId: true,
      owner: { select: { shortName: true } },
      assignments: { where: { until: null }, select: { id: true, from: true, ownerId: true, backupId: true } },
    },
  });
  if (!task) return { ok: false, error: 'Vazifa topilmadi' };

  const open = task.assignments[0];
  if (!open) {
    return { ok: false, error: 'Vazifada joriy biriktirish yo‘q — ma’lumot nomutanosib, bo‘lim boshlig‘iga xabar bering' };
  }

  const activeUsers = await db.user.findMany({
    where: { active: true, role: { in: ['HEAD', 'SPECIALIST'] } },
    select: { id: true, shortName: true },
  });

  const problem = validateReassign({
    currentOwnerId: open.ownerId,
    currentBackupId: open.backupId,
    newOwnerId: input.newOwnerId,
    newBackupId: input.newBackupId,
    effectiveFrom: input.effectiveFrom,
    currentFrom: open.from,
    activeUserIds: activeUsers.map((u) => u.id),
    now: new Date(),
  });
  if (problem) return { ok: false, error: problem };

  const nameOf = (id: string | null) =>
    id === null ? '—' : (activeUsers.find((u) => u.id === id)?.shortName ?? '?');

  await db.$transaction([
    db.taskAssignment.update({
      where: { id: open.id },
      data: { until: input.effectiveFrom },
    }),
    db.taskAssignment.create({
      data: {
        taskDefId: task.id,
        ownerId: input.newOwnerId,
        backupId: input.newBackupId,
        from: input.effectiveFrom,
        until: null,
        reason: input.reason,
        changedById: input.actorId,
      },
    }),
    db.taskDef.update({
      where: { id: task.id },
      data: { ownerId: input.newOwnerId, backupId: input.newBackupId },
    }),
  ]);

  const summary =
    `Vazifa №${task.no} "${task.title.slice(0, 50)}" — mas'ul ${task.owner.shortName} → ${nameOf(input.newOwnerId)}` +
    (input.newBackupId !== open.backupId ? `, zaxira ${nameOf(open.backupId)} → ${nameOf(input.newBackupId)}` : '') +
    (input.reason ? `. Sabab: ${input.reason}` : '');

  await logActivity({
    actorId: input.actorId,
    action: 'task.reassign',
    entity: 'TaskDef',
    entityId: String(task.id),
    summary,
  });

  return { ok: true, summary };
}

/**
 * Oxirgi QAYTA biriktirishlar.
 *
 * Vazifaning birinchi biriktirishi bu ro'yxatga kirmaydi — u boshlang'ich
 * taqsimot yoki yangi vazifa yaratilishi, "mas'ul almashdi" degani emas.
 * Shuning uchun har bir vazifaning eng erta oralig'i chiqarib tashlanadi.
 */
export async function recentReassignments(limit = 20) {
  const rows = await db.taskAssignment.findMany({
    where: { changedById: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: limit * 2,
    select: {
      id: true,
      from: true,
      reason: true,
      createdAt: true,
      owner: { select: { shortName: true } },
      backup: { select: { shortName: true } },
      changedBy: { select: { shortName: true } },
      taskDef: {
        select: {
          no: true,
          title: true,
          zoneCode: true,
          // Vazifaning eng erta oralig'i — solishtirish uchun
          assignments: { select: { from: true }, orderBy: { from: 'asc' }, take: 1 },
        },
      },
    },
  });

  return rows
    .filter((r) => {
      const earliest = r.taskDef.assignments[0]?.from;
      return earliest !== undefined && r.from.getTime() > earliest.getTime();
    })
    .slice(0, limit);
}

/**
 * Xodimlar kesimidagi joriy yuklama.
 * Faqat faol vazifalar sanaladi — arxivlangan vazifa yuklama bermaydi.
 */
export async function currentLoad() {
  const rows = await db.taskDef.groupBy({
    by: ['ownerId', 'kind'],
    where: { active: true },
    _count: { _all: true },
  });

  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.ownerId))] } },
    select: { id: true, shortName: true, active: true },
  });

  const byUser = new Map<string, { name: string; active: boolean; total: number; proactive: number; reactive: number }>();
  for (const r of rows) {
    const user = users.find((u) => u.id === r.ownerId);
    const bucket = byUser.get(r.ownerId) ?? {
      name: user?.shortName ?? '—',
      active: user?.active ?? false,
      total: 0,
      proactive: 0,
      reactive: 0,
    };
    bucket.total += r._count._all;
    if (r.kind === 'PROACTIVE') bucket.proactive += r._count._all;
    else bucket.reactive += r._count._all;
    byUser.set(r.ownerId, bucket);
  }

  return [...byUser.entries()]
    .map(([ownerId, b]) => ({ ownerId, ...b }))
    .sort((a, b) => b.total - a.total);
}

// ── Katalogni boshqarish: qo'shish, tahrirlash, arxivlash ───────────────────

export interface TaskMutationResult {
  ok: boolean;
  error?: string;
  taskNo?: number;
  summary?: string;
}

/**
 * Yangi vazifa qo'shadi.
 *
 * Raqam avtomatik beriladi (katalogdagi eng katta + 1) — o'chirilgan raqamlar
 * qayta ishlatilmaydi, aks holda eski hisobotlardagi "№12" boshqa vazifani
 * ko'rsatib qolardi.
 *
 * Bir tranzaksiyada vazifa va uning BOSHLANG'ICH BIRIKTIRISHI yaratiladi —
 * aks holda vazifa tarixsiz qolib, "kim javob bergan" savoliga javob bo'lmaydi.
 */
export async function createTask(input: {
  data: TaskInput;
  ownerId: string;
  backupId: string | null;
  actorId: string;
}): Promise<TaskMutationResult> {
  const problem = validateTaskInput(input.data);
  if (problem) return { ok: false, error: problem };

  const activeUsers = await db.user.findMany({
    where: { active: true, role: { in: ['HEAD', 'SPECIALIST'] } },
    select: { id: true, shortName: true },
  });

  const assigneeProblem = validateAssignee({
    ownerId: input.ownerId,
    backupId: input.backupId,
    activeUserIds: activeUsers.map((u) => u.id),
  });
  if (assigneeProblem) return { ok: false, error: assigneeProblem };

  const zone = await db.zone.findUnique({ where: { code: input.data.zoneCode }, select: { code: true } });
  if (!zone) return { ok: false, error: 'Bunday zona mavjud emas' };

  const existing = await db.taskDef.findMany({ select: { no: true } });
  const no = nextTaskNo(existing.map((t) => t.no));
  const now = new Date();

  const created = await db.taskDef.create({
    data: {
      no,
      zoneCode: input.data.zoneCode,
      title: input.data.title.trim(),
      source: input.data.source.trim(),
      ownerId: input.ownerId,
      backupId: input.backupId,
      frequency: input.data.frequency,
      slaHours: input.data.slaHours,
      priority: input.data.priority as Priority,
      kind: input.data.kind as Kind,
      active: true,
      assignments: {
        create: {
          ownerId: input.ownerId,
          backupId: input.backupId,
          from: now,
          until: null,
          reason: 'Yangi vazifa qo‘shildi',
          changedById: input.actorId,
        },
      },
    },
    select: { id: true, no: true, title: true },
  });

  const ownerName = activeUsers.find((u) => u.id === input.ownerId)?.shortName ?? '?';
  const summary = `Yangi vazifa №${created.no} "${created.title.slice(0, 60)}" — zona ${input.data.zoneCode}, mas'ul ${ownerName}`;

  await logActivity({
    actorId: input.actorId,
    action: 'task.create',
    entity: 'TaskDef',
    entityId: String(created.id),
    summary,
  });

  return { ok: true, taskNo: created.no, summary };
}

/**
 * Vazifa maydonlarini tahrirlaydi.
 *
 * MAS'UL va ZAXIRA bu yerda o'zgarmaydi — ular `reassignTask` orqali,
 * sanasi va sababi bilan almashtiriladi. Shu chegara tarixni himoyalaydi.
 */
export async function updateTask(input: {
  taskNo: number;
  data: TaskInput;
  actorId: string;
}): Promise<TaskMutationResult> {
  const problem = validateTaskInput(input.data);
  if (problem) return { ok: false, error: problem };

  const task = await db.taskDef.findUnique({
    where: { no: input.taskNo },
    select: {
      id: true,
      no: true,
      title: true,
      source: true,
      zoneCode: true,
      frequency: true,
      slaHours: true,
      priority: true,
      kind: true,
    },
  });
  if (!task) return { ok: false, error: 'Vazifa topilmadi' };

  const zone = await db.zone.findUnique({ where: { code: input.data.zoneCode }, select: { code: true } });
  if (!zone) return { ok: false, error: 'Bunday zona mavjud emas' };

  // O'zgargan maydonlarni izga yozamiz — nima o'zgarganini keyin ko'rish mumkin
  const changes: string[] = [];
  const title = input.data.title.trim();
  const source = input.data.source.trim();
  if (task.title !== title) changes.push('nomi');
  if (task.source !== source) changes.push('manbasi');
  if (task.zoneCode !== input.data.zoneCode) changes.push(`zona ${task.zoneCode} → ${input.data.zoneCode}`);
  if (task.frequency !== input.data.frequency) changes.push(`davriylik ${task.frequency} → ${input.data.frequency}`);
  if (task.slaHours !== input.data.slaHours) changes.push(`SLA ${task.slaHours ?? '—'} → ${input.data.slaHours ?? '—'}`);
  if (task.priority !== input.data.priority) changes.push(`ustuvorlik ${task.priority} → ${input.data.priority}`);
  if (task.kind !== input.data.kind) changes.push(`tur ${task.kind} → ${input.data.kind}`);

  if (changes.length === 0) return { ok: false, error: 'O‘zgarish yo‘q' };

  await db.taskDef.update({
    where: { id: task.id },
    data: {
      title,
      source,
      zoneCode: input.data.zoneCode,
      frequency: input.data.frequency,
      slaHours: input.data.slaHours,
      priority: input.data.priority as Priority,
      kind: input.data.kind as Kind,
    },
  });

  const summary = `Vazifa №${task.no} tahrirlandi: ${changes.join(', ')}`;
  await logActivity({
    actorId: input.actorId,
    action: 'task.update',
    entity: 'TaskDef',
    entityId: String(task.id),
    summary,
  });

  return { ok: true, taskNo: task.no, summary };
}

/**
 * Vazifani arxivlaydi yoki qaytaradi.
 * O'chirish emas: arxivlangan vazifa yuklama hisobiga kirmaydi, lekin
 * uning o'tgan murojaatlari va hisobotlari joyida qoladi.
 */
export async function setTaskActive(input: {
  taskNo: number;
  active: boolean;
  actorId: string;
}): Promise<TaskMutationResult> {
  const task = await db.taskDef.findUnique({
    where: { no: input.taskNo },
    select: { id: true, no: true, title: true, active: true, _count: { select: { tickets: true } } },
  });
  if (!task) return { ok: false, error: 'Vazifa topilmadi' };
  if (task.active === input.active) {
    return { ok: false, error: input.active ? 'Vazifa allaqachon faol' : 'Vazifa allaqachon arxivda' };
  }

  await db.taskDef.update({ where: { id: task.id }, data: { active: input.active } });

  const summary = `Vazifa №${task.no} ${input.active ? 'arxivdan qaytarildi' : 'arxivlandi'}${
    task._count.tickets > 0 ? ` (${task._count.tickets} ta murojaat tarixda qoladi)` : ''
  }`;
  await logActivity({
    actorId: input.actorId,
    action: input.active ? 'task.restore' : 'task.archive',
    entity: 'TaskDef',
    entityId: String(task.id),
    summary,
  });

  return { ok: true, taskNo: task.no, summary };
}

/** Vazifani butunlay o'chiradi — faqat murojaat va tarixi bo'lmasa. */
export async function deleteTask(input: { taskNo: number; actorId: string }): Promise<TaskMutationResult> {
  const task = await db.taskDef.findUnique({
    where: { no: input.taskNo },
    select: { id: true, no: true, title: true, _count: { select: { tickets: true, assignments: true } } },
  });
  if (!task) return { ok: false, error: 'Vazifa topilmadi' };

  const verdict = canDeleteTask({
    tickets: task._count.tickets,
    assignments: task._count.assignments,
  });
  if (!verdict.allowed) return { ok: false, error: verdict.reason ?? 'O‘chirib bo‘lmaydi' };

  await db.taskDef.delete({ where: { id: task.id } });

  const summary = `Vazifa №${task.no} "${task.title.slice(0, 60)}" o'chirildi`;
  await logActivity({
    actorId: input.actorId,
    action: 'task.delete',
    entity: 'TaskDef',
    entityId: String(task.id),
    summary,
  });

  return { ok: true, summary };
}

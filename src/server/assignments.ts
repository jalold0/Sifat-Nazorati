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

/** Barcha vazifalar bo'yicha oxirgi qayta biriktirishlar (boshlang'ich taqsimotdan tashqari). */
export async function recentReassignments(limit = 20) {
  return db.taskAssignment.findMany({
    where: { changedById: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      from: true,
      reason: true,
      createdAt: true,
      owner: { select: { shortName: true } },
      backup: { select: { shortName: true } },
      changedBy: { select: { shortName: true } },
      taskDef: { select: { no: true, title: true, zoneCode: true } },
    },
  });
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

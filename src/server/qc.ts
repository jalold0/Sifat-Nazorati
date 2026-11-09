/**
 * Sifat nazorati — server qatlami (ma'lumot va ruxsat).
 *
 * Har funksiya `actor` oladi va ruxsatni O'ZI tekshiradi: brauzerga ishonilmaydi.
 * Xatolar {ok:false, status, error} ko'rinishida — status: 400 tekshiruv, 403 ruxsat, 404 topilmadi;
 * `error` har doim o'zbekcha matn.
 * Server actions, route handler'lar va testlar shu qatlamni chaqiradi — framework'ga bog'liq emas.
 */

import { Prisma, type PrismaClient, type QcCheckpointKind, type QcListKind } from '@prisma/client';

import { db as defaultDb } from '@/lib/db';

import { writeJournal as logChange } from '@/shared/infrastructure/journal';

import { type Answer, auditCritical, type AuditRec, diffAnswers, scoreAnswers, type StaffBlock, type StaffPerson, type TaskInput, type TaskRec, validateAudit } from '@/modules/auditlar/domain';
import { type Checkpoint, type CheckpointKind, diffDept } from '@/modules/bolimlar/domain';
import { canCreateAudit, canDeleteAudit, canEditAudit, canEditTask, canManageDepartments, canReadDept, deptScope } from '@/modules/foydalanuvchilar/domain';
import type { Actor } from '@/shared/actor';
import { isListKind, type ListKind } from '@/shared/lists';
import { joinSummary } from '@/shared/text';
import { isYmd, todayTashkent } from '@/shared/time';

export type Res<T> = { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 409; error: string };

const ok = <T>(data: T): Res<T> => ({ ok: true, data });
const bad = (error: string): Res<never> => ({ ok: false, status: 400, error });
const forbidden = (error = 'Bu amalga ruxsatingiz yo‘q.'): Res<never> => ({ ok: false, status: 403, error });
const notFound = (error: string): Res<never> => ({ ok: false, status: 404, error });

/** Testlarda boshqa Prisma mijozi berilishi mumkin. */
export interface Ctx {
  db?: PrismaClient;
  now?: Date;
}
const dbOf = (ctx?: Ctx) => ctx?.db ?? defaultDb;
const nowOf = (ctx?: Ctx) => ctx?.now ?? new Date();

// ── DTO'lar (brauzerga uzatiladigan oddiy obyektlar) ─────────────────────────

export interface DeptDto {
  id: string;
  name: string;
  position: number;
  active: boolean;
  norm: number;
  estimate: boolean;
  checkpoints: Checkpoint[];
  /** Bo'lim hodimlari (yashirilganlari ham — `active`), tartib bo'yicha. */
  staff: StaffDto[];
}

export interface StaffDto {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

const KIND_FROM_DB: Record<QcCheckpointKind, CheckpointKind> = {
  CHECK: 'check',
  STAFF_CHECK: 'staff_check',
  STAFF_COUNT: 'staff_count',
};
const KIND_TO_DB: Record<CheckpointKind, QcCheckpointKind> = {
  check: 'CHECK',
  staff_check: 'STAFF_CHECK',
  staff_count: 'STAFF_COUNT',
};

const LIST_FROM_DB: Record<QcListKind, ListKind> = { SHIFT: 'shift', INTERACTION: 'interaction', WEEKLY: 'weekly' };
const LIST_TO_DB: Record<ListKind, QcListKind> = { shift: 'SHIFT', interaction: 'INTERACTION', weekly: 'WEEKLY' };

/** Json ustunidan o'qilgan hodimlar bloki (eski yozuvda null). */
const staffOf = (v: Prisma.JsonValue | null): StaffBlock | null => (v && typeof v === 'object' ? (v as unknown as StaffBlock) : null);
/** Json ustuniga yozish: null — bazada NULL. */
const staffJson = (b: StaffBlock | null) => (b ? (b as unknown as Prisma.InputJsonValue) : Prisma.DbNull);

export interface AuditDto extends AuditRec {
  by: string;
  byName: string;
  subject: string;
  notes: Record<string, { text: string; ref: string }>;
  createdAt: string;
  updatedAt: string;
  noCount: number;
  scorePct: number | null;
  list: ListKind;
  /** Muloqot bahosida baholangan operator ismi */
  staffName: string | null;
}

export interface TaskDto extends TaskRec {
  checkNote: string | null;
  checkedByName: string | null;
}

/** Bo'lim + nuqtalar + hodimlar — DeptDto uchun yagona `include`. */
const DEPT_INCLUDE = { checkpoints: true, staff: true } satisfies Prisma.QcDepartmentInclude;
type DeptRow = Prisma.QcDepartmentGetPayload<{ include: typeof DEPT_INCLUDE }>;

function toDept(d: DeptRow): DeptDto {
  return {
    id: d.id,
    name: d.name,
    position: d.position,
    active: d.active,
    norm: d.norm,
    estimate: d.estimate,
    checkpoints: [...d.checkpoints]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        text: c.text,
        group: c.grp,
        weight: c.weight,
        critical: c.critical,
        active: c.active,
        kind: KIND_FROM_DB[c.kind],
        okLabel: c.okLabel,
        badLabel: c.badLabel,
        list: LIST_FROM_DB[c.list],
      })),
    staff: [...d.staff]
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      .map((s) => ({ id: s.id, name: s.name, role: s.role, active: s.active })),
  };
}

/** Tekshiruv + kiritgan + baholangan operator — AuditDto uchun yagona `include`. */
const AUDIT_INCLUDE = {
  by: { select: { shortName: true } },
  staffRef: { select: { name: true } },
} satisfies Prisma.QcAuditInclude;
type AuditRow = Prisma.QcAuditGetPayload<{ include: typeof AUDIT_INCLUDE }>;

function toAudit(a: AuditRow, checkpoints: Checkpoint[]): AuditDto {
  const answers = a.answers as Record<string, Answer>;
  const staff = staffOf(a.staff);
  return {
    list: LIST_FROM_DB[a.list],
    staffId: a.staffId,
    staffName: a.staffRef?.name ?? null,
    channel: a.channel,
    id: a.id,
    dept: a.deptId,
    date: a.date,
    by: a.byId,
    byName: a.by.shortName,
    subject: a.subject,
    answers,
    notes: a.notes as AuditDto['notes'],
    critical: a.critical,
    staff,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    noCount: Object.values(answers).filter((v) => v === 'no').length,
    scorePct: scoreAnswers(answers, checkpoints, a.weights as Record<string, number> | null, staff).pct,
  };
}

type TaskRow = Prisma.QcTaskGetPayload<{ include: { checkedBy: { select: { shortName: true } } } }>;

function toTask(t: TaskRow): TaskDto {
  return {
    id: t.id,
    audit: t.auditId,
    dept: t.deptId,
    cp: t.cpId,
    what: t.what,
    owner: t.owner,
    due: t.due,
    status: t.status === 'OPEN' ? 'open' : 'closed',
    closedAt: t.checkedOn,
    checkNote: t.checkNote,
    checkedByName: t.checkedBy?.shortName ?? null,
  };
}

// ── O'qish ───────────────────────────────────────────────────────────────────

/** Bo'limlar va nuqtalar. Ko'ruvchi faqat o'z bo'limini oladi. Nofaol bo'limlar faqat so'ralganda. */
export async function listDepartments(
  actor: Actor,
  opts: { includeInactive?: boolean } = {},
  ctx?: Ctx,
): Promise<DeptDto[]> {
  const scope = deptScope(actor);
  const rows = await dbOf(ctx).qcDepartment.findMany({
    where: {
      ...(opts.includeInactive ? {} : { active: true }),
      ...(scope ? { id: scope } : {}),
    },
    include: DEPT_INCLUDE,
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toDept);
}

export interface SummaryData {
  today: string;
  departments: DeptDto[];
  audits: AuditRec[];
  tasks: TaskRec[];
}

/**
 * Hisoblash uchun xom yozuvlar (bitta so'rovda): `from` dan `to` gacha tekshiruvlar va
 * hisoblashga kerak topshiriqlar (muddati `from` dan keyin yoki hali ochiq bo'lganlar).
 */
export async function getSummaryData(
  actor: Actor,
  q: { dept?: string; from: string; to: string },
  ctx?: Ctx,
): Promise<Res<SummaryData>> {
  if (!isYmd(q.from) || !isYmd(q.to) || q.from > q.to) return bad('Davr noto‘g‘ri: boshlanish sanasi oxirgisidan keyin bo‘lmasligi kerak.');
  if (q.dept && !canReadDept(actor, q.dept)) return forbidden('Bu bo‘limni ko‘rishga ruxsatingiz yo‘q.');

  const departments = (await listDepartments(actor, {}, ctx)).filter((d) => !q.dept || d.id === q.dept);
  const ids = departments.map((d) => d.id);
  const client = dbOf(ctx);

  const [audits, tasks] = await Promise.all([
    client.qcAudit.findMany({
      where: { deptId: { in: ids }, date: { gte: q.from, lte: q.to } },
      select: { id: true, deptId: true, date: true, answers: true, critical: true, weights: true, staff: true, list: true, staffId: true, channel: true },
    }),
    client.qcTask.findMany({
      where: { deptId: { in: ids }, OR: [{ due: { gte: q.from } }, { status: 'OPEN' }, { checkedOn: { gte: q.from } }] },
      select: { id: true, auditId: true, deptId: true, cpId: true, what: true, owner: true, due: true, status: true, checkedOn: true, createdAt: true },
    }),
  ]);

  return ok({
    today: todayTashkent(nowOf(ctx)),
    departments,
    audits: audits.map((a) => ({
      id: a.id,
      dept: a.deptId,
      date: a.date,
      answers: a.answers as Record<string, Answer>,
      critical: a.critical,
      weights: a.weights as Record<string, number> | null,
      staff: staffOf(a.staff),
      list: LIST_FROM_DB[a.list],
      staffId: a.staffId,
      channel: a.channel,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      audit: t.auditId,
      dept: t.deptId,
      cp: t.cpId,
      what: t.what,
      owner: t.owner,
      due: t.due,
      status: t.status === 'OPEN' ? ('open' as const) : ('closed' as const),
      closedAt: t.checkedOn,
      createdOn: todayTashkent(t.createdAt),
    })),
  });
}

export const PAGE_SIZE = 50;

export interface AuditQuery {
  dept?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  /** Faqat shu cheklist */
  list?: ListKind;
}

/** Tekshiruvlar ro'yxati: yangisi birinchi, 50 tadan. */
export async function listAudits(
  actor: Actor,
  q: AuditQuery,
  ctx?: Ctx,
): Promise<Res<{ rows: AuditDto[]; total: number }>> {
  if (q.dept && !canReadDept(actor, q.dept)) return forbidden('Bu bo‘limni ko‘rishga ruxsatingiz yo‘q.');
  if ((q.from && !isYmd(q.from)) || (q.to && !isYmd(q.to))) return bad('Sana noto‘g‘ri: YYYY-MM-DD ko‘rinishida kiriting.');

  const scope = deptScope(actor);
  const where: Prisma.QcAuditWhereInput = {
    ...(q.dept ? { deptId: q.dept } : scope ? { deptId: scope } : {}),
    ...(q.from || q.to ? { date: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    ...(q.list ? { list: LIST_TO_DB[q.list] } : {}),
  };
  const take = Math.min(Math.max(q.limit ?? PAGE_SIZE, 1), 50_000);
  const skip = Math.max(q.offset ?? 0, 0);
  const client = dbOf(ctx);

  const [rows, total, depts] = await Promise.all([
    client.qcAudit.findMany({
      where,
      include: AUDIT_INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
    }),
    client.qcAudit.count({ where }),
    client.qcCheckpoint.findMany({ select: { deptId: true, id: true, weight: true } }),
  ]);

  const weights = new Map<string, Checkpoint[]>();
  for (const c of depts) {
    const list = weights.get(c.deptId) ?? [];
    list.push({ id: c.id, text: '', weight: c.weight, critical: false, active: true });
    weights.set(c.deptId, list);
  }
  return ok({ rows: rows.map((r) => toAudit(r, weights.get(r.deptId) ?? [])), total });
}

export async function getAudit(
  actor: Actor,
  id: string,
  ctx?: Ctx,
): Promise<Res<{ audit: AuditDto; dept: DeptDto; tasks: TaskDto[]; canEdit: boolean; canDelete: boolean }>> {
  const client = dbOf(ctx);
  const row = await client.qcAudit.findUnique({
    where: { id },
    include: { ...AUDIT_INCLUDE, dept: { include: DEPT_INCLUDE } },
  });
  if (!row) return notFound('Tekshiruv topilmadi. U o‘chirilgan bo‘lishi mumkin.');
  if (!canReadDept(actor, row.deptId)) return forbidden('Bu bo‘limni ko‘rishga ruxsatingiz yo‘q.');

  const dept = toDept(row.dept);
  const tasks = await client.qcTask.findMany({
    where: { auditId: id },
    include: { checkedBy: { select: { shortName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return ok({
    audit: toAudit(row, dept.checkpoints),
    dept,
    tasks: tasks.map(toTask),
    canEdit: canEditAudit(actor, { byId: row.byId, createdAt: row.createdAt }, nowOf(ctx)),
    canDelete: canDeleteAudit(actor),
  });
}

export interface TaskQuery {
  dept?: string;
  status?: 'open' | 'closed';
  dueBefore?: string;
}

export async function listTasks(actor: Actor, q: TaskQuery, ctx?: Ctx): Promise<Res<TaskDto[]>> {
  if (q.dept && !canReadDept(actor, q.dept)) return forbidden('Bu bo‘limni ko‘rishga ruxsatingiz yo‘q.');
  if (q.dueBefore && !isYmd(q.dueBefore)) return bad('Sana noto‘g‘ri: YYYY-MM-DD ko‘rinishida kiriting.');
  const scope = deptScope(actor);
  const rows = await dbOf(ctx).qcTask.findMany({
    where: {
      ...(q.dept ? { deptId: q.dept } : scope ? { deptId: scope } : {}),
      ...(q.status ? { status: q.status === 'open' ? 'OPEN' : 'CLOSED' } : {}),
      ...(q.dueBefore ? { due: { lt: q.dueBefore } } : {}),
    },
    include: { checkedBy: { select: { shortName: true } } },
    orderBy: [{ due: 'asc' }, { createdAt: 'asc' }],
  });
  return ok(rows.map(toTask));
}

export type TaskTab = 'overdue' | 'open' | 'closed';

/**
 * Topshiriqlar sahifasi: tanlangan varaq bazada filtrlanadi va 50 tadan sahifalanadi, sonlar `count()` bilan
 * olinadi — topshiriqlar ko'paysa ham hech biri ro'yxatdan jim tushib qolmaydi.
 * Muddati o'tgan va ochiq — muddat bo'yicha (eng shoshilinchi birinchi); yopilgan — eng oxirgi yopilgani birinchi.
 */
export async function listTaskTab(
  actor: Actor,
  q: { tab: TaskTab; dept?: string; offset?: number },
  ctx?: Ctx,
): Promise<Res<{ rows: TaskDto[]; total: number; counts: Record<TaskTab, number> }>> {
  if (q.dept && !canReadDept(actor, q.dept)) return forbidden('Bu bo‘limni ko‘rishga ruxsatingiz yo‘q.');
  const scope = deptScope(actor);
  const base: Prisma.QcTaskWhereInput = q.dept ? { deptId: q.dept } : scope ? { deptId: scope } : {};
  const today = todayTashkent(nowOf(ctx));
  const where: Record<TaskTab, Prisma.QcTaskWhereInput> = {
    overdue: { ...base, status: 'OPEN', due: { lt: today } },
    open: { ...base, status: 'OPEN' },
    closed: { ...base, status: 'CLOSED' },
  };
  const orderBy: Prisma.QcTaskOrderByWithRelationInput[] =
    q.tab === 'closed' ? [{ checkedOn: 'desc' }, { updatedAt: 'desc' }] : [{ due: 'asc' }, { createdAt: 'asc' }];
  const client = dbOf(ctx);
  const [rows, overdue, open, closed] = await Promise.all([
    client.qcTask.findMany({
      where: where[q.tab],
      include: { checkedBy: { select: { shortName: true } } },
      orderBy,
      take: PAGE_SIZE,
      skip: Math.max(q.offset ?? 0, 0),
    }),
    client.qcTask.count({ where: where.overdue }),
    client.qcTask.count({ where: where.open }),
    client.qcTask.count({ where: where.closed }),
  ]);
  const counts = { overdue, open, closed };
  return ok({ rows: rows.map(toTask), total: counts[q.tab], counts });
}

// ── Tekshiruv yozish ─────────────────────────────────────────────────────────

async function loadDept(client: PrismaClient, id: string): Promise<DeptDto | null> {
  const d = await client.qcDepartment.findUnique({ where: { id }, include: DEPT_INCLUDE });
  return d ? toDept(d) : null;
}

/** Tekshiruvda tanlash mumkin bo'lgan hodimlar. Ism mijozdan emas — shu ro'yxatdan olinadi. */
function rosterOf(dept: DeptDto, opts: { includeHidden: boolean }): StaffPerson[] {
  return dept.staff.filter((s) => opts.includeHidden || s.active).map((s) => ({ id: s.id, name: s.name }));
}

function taskRows(auditId: string, deptId: string, tasks: TaskInput[]): Prisma.QcTaskCreateManyInput[] {
  return tasks.map((t) => ({ auditId, deptId, cpId: t.cp, what: t.what, owner: t.owner, due: t.due }));
}

/**
 * Tekshiruv va unga bog'liq topshiriqlarni BITTA tranzaksiyada saqlaydi (xato bo'lsa hech biri saqlanmaydi).
 * `by`, `createdAt`, `updatedAt`, `critical` ni faqat server qo'yadi — mijozdan kelganlar e'tiborga olinmaydi.
 */
export async function createAudit(actor: Actor, body: unknown, ctx?: Ctx): Promise<Res<{ id: string }>> {
  if (!canCreateAudit(actor)) return forbidden('Tekshiruv kiritish huquqingiz yo‘q.');
  const raw = (body ?? {}) as { dept?: unknown; list?: unknown };
  const deptId = typeof raw.dept === 'string' ? raw.dept : '';
  const list: ListKind = raw.list === undefined ? 'shift' : isListKind(raw.list) ? raw.list : ('' as ListKind);
  if (!isListKind(list)) return bad('Cheklist noto‘g‘ri.');
  if (!canCreateAudit(actor, { deptId, list })) {
    return forbidden('Bu cheklistni kiritish huquqingiz yo‘q: supervayzer faqat o‘z bo‘limining kunlik smena cheklistini kiritadi.');
  }
  const client = dbOf(ctx);
  const dept = deptId ? await loadDept(client, deptId) : null;
  if (!dept) return bad('Bo‘lim topilmadi. Bo‘limni tanlang.');
  if (!dept.active) return bad('Bu bo‘lim faol emas. Boshqa bo‘limni tanlang.');

  const v = validateAudit(body, dept.checkpoints, {
    today: todayTashkent(nowOf(ctx)),
    allowPast: false,
    requireComplete: true,
    roster: rosterOf(dept, { includeHidden: false }),
    list,
  });
  if (!v.ok) return bad(v.error);
  const d = v.data;

  const id = await client.$transaction(async (tx) => {
    const audit = await tx.qcAudit.create({
      data: {
        deptId,
        date: d.date,
        byId: actor.id,
        answers: d.answers,
        notes: d.notes,
        subject: d.subject,
        staff: staffJson(d.staff),
        list: LIST_TO_DB[d.list],
        staffId: d.staffId,
        channel: d.channel,
        critical: auditCritical(d.answers, dept.checkpoints),
        // Kiritilgan paytdagi og'irliklar qotiriladi: keyin sozlama o'zgarsa ham bu tekshiruv bali o'zgarmaydi
        weights: Object.fromEntries(dept.checkpoints.map((c) => [c.id, c.weight])),
      },
      select: { id: true },
    });
    await tx.qcTask.createMany({ data: taskRows(audit.id, deptId, d.tasks) });
    return audit.id;
  });
  return ok({ id });
}

/**
 * Tuzatish. Tekshiruvchi — faqat o'zi kiritgan va 24 soat ichida; rahbar — doim (va o'tgan sanaga ham).
 * Ochiq topshiriqlar yangi ro'yxat bilan almashtiriladi; yopilganlar saqlanadi.
 */
export async function updateAudit(actor: Actor, id: string, body: unknown, ctx?: Ctx): Promise<Res<{ id: string }>> {
  const client = dbOf(ctx);
  const row = await client.qcAudit.findUnique({ where: { id } });
  if (!row) return notFound('Tekshiruv topilmadi.');
  if (!canReadDept(actor, row.deptId) || !canEditAudit(actor, { byId: row.byId, createdAt: row.createdAt }, nowOf(ctx))) {
    return forbidden('Bu tekshiruvni tuzatish mumkin emas: faqat o‘zingiz kiritgan va 24 soat ichida.');
  }
  const dept = await loadDept(client, row.deptId);
  if (!dept) return notFound('Bo‘lim topilmadi.');

  const v = validateAudit({ ...(body as object), dept: row.deptId }, dept.checkpoints, {
    today: todayTashkent(nowOf(ctx)),
    allowPast: actor.role === 'HEAD',
    requireComplete: false,
    // Tuzatishda yashirilgan hodimlar ham (tekshiruv paytida faol bo'lgan bo'lishi mumkin)
    roster: rosterOf(dept, { includeHidden: true }),
    // Cheklist o'zgarmaydi — tekshiruv qaysi cheklist bilan kiritilgan bo'lsa, shu bilan tuzatiladi
    list: LIST_FROM_DB[row.list],
  });
  if (!v.ok) return bad(v.error);
  const d = v.data;
  // Tekshiruvchi sanani o'zgartira olmaydi
  const date = actor.role === 'HEAD' ? d.date : row.date;

  const lines = diffAnswers(row.answers as Record<string, Answer>, d.answers);
  if (date !== row.date) lines.unshift(`Sana: ${row.date} → ${date}`);
  if (JSON.stringify(staffOf(row.staff)) !== JSON.stringify(d.staff)) lines.push('hodimlar natijasi o‘zgardi');
  await client.$transaction(async (tx) => {
    await tx.qcAudit.update({
      where: { id },
      data: {
        date,
        answers: d.answers,
        notes: d.notes,
        subject: d.subject,
        staff: staffJson(d.staff),
        staffId: d.staffId,
        channel: d.channel,
        critical: auditCritical(d.answers, dept.checkpoints),
        // Og'irliklar birinchi kiritishdagidek qoladi (eski yozuvda bo'lmasa — hozirgidan qotiriladi)
        weights: (row.weights as Record<string, number> | null) ?? Object.fromEntries(dept.checkpoints.map((c) => [c.id, c.weight])),
      },
    });
    await logChange(tx, {
      actorId: actor.id,
      action: 'audit.update',
      entity: 'QcAudit',
      entityId: id,
      summary: `Tekshiruv tuzatildi (${dept.name}, ${row.date}): ${joinSummary(lines)}`,
      details: { before: { answers: row.answers, notes: row.notes, subject: row.subject, staff: row.staff ?? null } as object },
    });
    await tx.qcTask.deleteMany({ where: { auditId: id, status: 'OPEN' } });
    // Allaqachon yopilgan topshirig'i bor nuqtaga takroran topshiriq ochilmaydi
    const closed = new Set((await tx.qcTask.findMany({ where: { auditId: id }, select: { cpId: true } })).map((t) => t.cpId));
    await tx.qcTask.createMany({ data: taskRows(id, row.deptId, d.tasks.filter((t) => !closed.has(t.cp))) });
  });
  return ok({ id });
}

export async function deleteAudit(actor: Actor, id: string, ctx?: Ctx): Promise<Res<{ id: string }>> {
  if (!canDeleteAudit(actor)) return forbidden('Tekshiruvni faqat rahbar o‘chira oladi.');
  const client = dbOf(ctx);
  const row = await client.qcAudit.findUnique({ where: { id }, include: { dept: { select: { name: true } }, tasks: true, by: { select: { shortName: true } } } });
  if (!row) return notFound('Tekshiruv topilmadi.');
  await client.$transaction(async (tx) => {
    // Jurnalga to'liq nusxa yoziladi: o'chirilgan tekshiruv izsiz yo'qolmasin
    await logChange(tx, {
      actorId: actor.id,
      action: 'audit.delete',
      entity: 'QcAudit',
      entityId: id,
      summary: `Tekshiruv o‘chirildi (${row.dept.name}, ${row.date}, kiritgan: ${row.by.shortName}, topshiriq: ${row.tasks.length} ta)`,
      details: {
        dept: row.dept.name,
        date: row.date,
        by: row.by.shortName,
        subject: row.subject,
        critical: row.critical,
        answers: row.answers,
        notes: row.notes,
        weights: row.weights ?? null,
        staff: row.staff ?? null,
        tasks: row.tasks.map((t) => ({ cp: t.cpId, what: t.what, owner: t.owner, due: t.due, status: t.status, checkNote: t.checkNote })),
      } as object,
    });
    await tx.qcAudit.delete({ where: { id } }); // topshiriqlari bilan (cascade)
  });
  return ok({ id });
}

// ── Topshiriqlar ─────────────────────────────────────────────────────────────

/** «Qayta tekshirdim»: izoh majburiy, topshiriq yopiladi. */
export async function closeTask(actor: Actor, id: string, note: unknown, ctx?: Ctx): Promise<Res<{ id: string }>> {
  if (!canEditTask(actor)) return forbidden('Topshiriqni yopish huquqingiz yo‘q.');
  const text = typeof note === 'string' ? note.trim() : '';
  if (!text) return bad('Qayta tekshirish izohini yozing: nima tekshirilganini qisqa ko‘rsating.');
  const client = dbOf(ctx);
  const row = await client.qcTask.findUnique({ where: { id } });
  if (!row) return notFound('Topshiriq topilmadi.');
  if (row.status === 'CLOSED') return bad('Bu topshiriq allaqachon yopilgan.');
  await client.qcTask.update({
    where: { id },
    data: { status: 'CLOSED', checkedById: actor.id, checkedOn: todayTashkent(nowOf(ctx)), checkNote: text },
  });
  return ok({ id });
}

export async function updateTask(
  actor: Actor,
  id: string,
  body: { what?: unknown; owner?: unknown; due?: unknown },
  ctx?: Ctx,
): Promise<Res<{ id: string }>> {
  if (!canEditTask(actor)) return forbidden('Topshiriqni tahrirlash huquqingiz yo‘q.');
  const client = dbOf(ctx);
  const row = await client.qcTask.findUnique({ where: { id } });
  if (!row) return notFound('Topshiriq topilmadi.');
  const what = typeof body.what === 'string' ? body.what.trim() : row.what;
  const owner = typeof body.owner === 'string' ? body.owner.trim() : row.owner;
  const due = typeof body.due === 'string' ? body.due.trim() : row.due;
  if (!what) return bad('«Nima qilinishi kerak» maydonini to‘ldiring.');
  if (!owner) return bad('Mas‘ul shaxsni yozing.');
  if (!isYmd(due)) return bad('Muddat noto‘g‘ri: sanani tanlang.');
  const lines: string[] = [];
  if (what !== row.what) lines.push(`nima: «${what}»`);
  if (owner !== row.owner) lines.push(`mas‘ul: ${row.owner} → ${owner}`);
  if (due !== row.due) lines.push(`muddat: ${row.due} → ${due}`);
  await client.$transaction(async (tx) => {
    await tx.qcTask.update({ where: { id }, data: { what, owner, due } });
    if (lines.length > 0) {
      await logChange(tx, { actorId: actor.id, action: 'task.update', entity: 'QcTask', entityId: id, summary: `Topshiriq tahrirlandi: ${lines.join('; ')}` });
    }
  });
  return ok({ id });
}

// ── Sozlamalar (faqat rahbar) ────────────────────────────────────────────────

export interface DeptInput {
  id?: string;
  name: string;
  norm: number;
  estimate: boolean;
  active: boolean;
  checkpoints: Array<{
    id?: string;
    text: string;
    group?: string | null;
    weight: number;
    critical: boolean;
    active: boolean;
    /** Bo'lmasa — 'check' */
    kind?: CheckpointKind;
    okLabel?: string | null;
    badLabel?: string | null;
    /** Bo'lmasa — 'shift' (kunlik smena) */
    list?: ListKind;
  }>;
  /** Bo'lim hodimlari. Bo'lmasa — o'zgarmaydi. Hodim o'chirilmaydi, faqat `active:false`. */
  staff?: Array<{ id?: string; name: string; role?: string; active: boolean }>;
}

const KINDS = new Set<CheckpointKind>(['check', 'staff_check', 'staff_count']);
const LABEL_MAX = 40;
const cleanLabel = (v: string | null | undefined) => (v ?? '').trim().slice(0, LABEL_MAX) || null;

/**
 * Bo'lim yaratish/o'zgartirish. Nuqtalar O'CHIRILMAYDI — faqat `active:false` qilinadi;
 * yangi nuqtaga bo'lim ichida keyingi `cpN` id beriladi. Massivdagi tartib — nuqtalar tartibi.
 */
export async function saveDepartment(actor: Actor, input: DeptInput, ctx?: Ctx): Promise<Res<{ id: string }>> {
  if (!canManageDepartments(actor)) return forbidden('Bo‘limlarni faqat rahbar o‘zgartira oladi.');
  const name = (input.name ?? '').trim();
  if (!name) return bad('Bo‘lim nomini yozing.');
  if (!Number.isInteger(input.norm) || input.norm < 1 || input.norm > 100) return bad('Me‘yor 1 dan 100 gacha butun son bo‘lishi kerak.');
  if (!Array.isArray(input.checkpoints) || input.checkpoints.length === 0) return bad('Kamida bitta nuqta kerak.');
  for (const c of input.checkpoints) {
    if (!c.text?.trim()) return bad('Har bir nuqtaga savol matnini yozing (bo‘sh nuqtani «yashirish» mumkin).');
    if (![1, 2, 3].includes(c.weight)) return bad('Nuqta og‘irligi 1, 2 yoki 3 bo‘lishi kerak.');
    if (c.kind !== undefined && !KINDS.has(c.kind)) return bad('Nuqta turi noto‘g‘ri.');
    if (c.list !== undefined && !isListKind(c.list)) return bad('Nuqtaning cheklisti noto‘g‘ri.');
    if (c.list === 'interaction' && c.kind && c.kind !== 'check') {
      return bad(`«${c.text.trim()}»: muloqot bahosi bitta operatorni baholaydi — turi «Butun bo‘lim: Ha / Yo‘q» bo‘lsin.`);
    }
  }
  if (!input.checkpoints.some((c) => c.active)) return bad('Kamida bitta faol nuqta qoldiring.');
  const staffIn = input.staff;
  if (staffIn !== undefined) {
    if (!Array.isArray(staffIn) || staffIn.length > 200) return bad('Hodimlar ro‘yxati noto‘g‘ri (ko‘pi bilan 200 kishi).');
    const seen = new Set<string>();
    for (const s of staffIn) {
      const n = (s.name ?? '').trim();
      if (!n) return bad('Har bir hodimning ismini yozing (keraksizini «yashirish» mumkin).');
      if (n.length > 80) return bad('Hodim ismi 80 belgidan oshmasin.');
      const key = n.toLowerCase();
      if (s.active && seen.has(key)) return bad(`«${n}» ro‘yxatda ikki marta. Ismlarni farqlang (masalan familiya qo‘shing).`);
      if (s.active) seen.add(key);
    }
  }
  const hasStaffCp = input.checkpoints.some((c) => c.active && c.kind && c.kind !== 'check');

  const client = dbOf(ctx);
  const dupe = await client.qcDepartment.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(input.id ? { NOT: { id: input.id } } : {}) },
    select: { id: true },
  });
  if (dupe) return bad('Bunday nomli bo‘lim allaqachon bor. Boshqa nom tanlang.');

  const existing = input.id
    ? await client.qcDepartment.findUnique({ where: { id: input.id }, include: DEPT_INCLUDE })
    : null;
  if (input.id && !existing) return notFound('Bo‘lim topilmadi.');
  const known = new Set((existing?.checkpoints ?? []).map((c) => c.id));
  for (const c of input.checkpoints) {
    if (c.id && !known.has(c.id)) return bad('Nuqta topilmadi. Sahifani yangilang.');
  }
  const knownStaff = new Set((existing?.staff ?? []).map((s) => s.id));
  for (const s of staffIn ?? []) {
    if (s.id && !knownStaff.has(s.id)) return bad('Hodim topilmadi. Sahifani yangilang.');
  }
  const activeStaff = staffIn ? staffIn.filter((s) => s.active).length : (existing?.staff ?? []).filter((s) => s.active).length;
  if (hasStaffCp && activeStaff === 0) {
    return bad('Hodimlar kesimidagi nuqta bor, lekin bo‘limda faol hodim yo‘q. Avval hodimlarni qo‘shing.');
  }

  const after = {
    ...input,
    name,
    checkpoints: input.checkpoints.map((c) => ({
      ...c,
      text: c.text.trim(),
      kind: c.kind ?? 'check',
      okLabel: cleanLabel(c.okLabel),
      badLabel: cleanLabel(c.badLabel),
      list: c.list ?? 'shift',
    })),
    staff: staffIn?.map((s) => ({ ...s, name: s.name.trim(), role: (s.role ?? '').trim() })),
  };
  const lines = diffDept(existing ? toDept(existing) : null, after);
  const id = await client.$transaction(async (tx) => {
    let deptId = existing?.id;
    if (existing) {
      await tx.qcDepartment.update({
        where: { id: existing.id },
        data: { name, norm: input.norm, estimate: input.estimate, active: input.active },
      });
    } else {
      const max = await tx.qcDepartment.aggregate({ _max: { position: true } });
      const created = await tx.qcDepartment.create({
        data: { name, norm: input.norm, estimate: input.estimate, active: input.active, position: (max._max.position ?? 0) + 1 },
      });
      deptId = created.id;
    }
    let next = (existing?.checkpoints ?? []).reduce((m, c) => Math.max(m, Number(c.id.replace(/^cp/, '')) || 0), 0);
    for (const [i, c] of after.checkpoints.entries()) {
      const data = {
        text: c.text,
        grp: c.group?.trim() || null,
        weight: c.weight,
        critical: c.critical,
        active: c.active,
        position: i + 1,
        kind: KIND_TO_DB[c.kind],
        okLabel: c.okLabel,
        badLabel: c.badLabel,
        list: LIST_TO_DB[c.list],
      };
      if (c.id) {
        await tx.qcCheckpoint.update({ where: { deptId_id: { deptId: deptId as string, id: c.id } }, data });
      } else {
        next += 1;
        await tx.qcCheckpoint.create({ data: { ...data, deptId: deptId as string, id: `cp${next}` } });
      }
    }
    // Hodimlar: tartib — massivdagi tartib; o'chirilmaydi, faqat yashiriladi
    for (const [i, s] of (after.staff ?? []).entries()) {
      const data = { name: s.name, role: s.role, active: s.active, position: i + 1 };
      if (s.id) await tx.qcStaff.update({ where: { id: s.id }, data });
      else await tx.qcStaff.create({ data: { ...data, deptId: deptId as string } });
    }
    if (lines.length > 0) {
      await logChange(tx, {
        actorId: actor.id,
        action: 'dept.save',
        entity: 'QcDepartment',
        entityId: deptId as string,
        summary: `${name}: ${lines.join('; ')}`,
      });
    }
    return deptId as string;
  });
  return ok({ id });
}

/** Bo'lim tartibini o'zgartirish (panelda ko'rinish tartibi). */
export async function moveDepartment(actor: Actor, id: string, dir: -1 | 1, ctx?: Ctx): Promise<Res<{ id: string }>> {
  if (!canManageDepartments(actor)) return forbidden('Bo‘limlarni faqat rahbar o‘zgartira oladi.');
  const client = dbOf(ctx);
  const all = await client.qcDepartment.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true, name: true } });
  const i = all.findIndex((d) => d.id === id);
  if (i < 0) return notFound('Bo‘lim topilmadi.');
  const j = i + dir;
  if (j < 0 || j >= all.length) return ok({ id });
  const order = all.map((d) => d.id);
  [order[i], order[j]] = [order[j] as string, order[i] as string];
  await client.$transaction([
    ...order.map((deptId, idx) => client.qcDepartment.update({ where: { id: deptId }, data: { position: idx + 1 } })),
    client.qcLog.create({ data: { actorId: actor.id, action: 'dept.move', entity: 'QcDepartment', entityId: id, summary: `Bo‘lim tartibi o‘zgardi: «${all[i]?.name ?? ''}» ${dir < 0 ? 'yuqoriga' : 'pastga'}` } }),
  ]);
  return ok({ id });
}

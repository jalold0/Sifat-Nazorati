/**
 * Sifat nazorati — server qatlami (ma'lumot va ruxsat).
 *
 * Har funksiya `actor` oladi va ruxsatni O'ZI tekshiradi: brauzerga ishonilmaydi.
 * Xatolar {ok:false, status, error} ko'rinishida — status: 400 tekshiruv, 403 ruxsat, 404 topilmadi;
 * `error` har doim o'zbekcha matn.
 * Server actions, route handler'lar va testlar shu qatlamni chaqiradi — framework'ga bog'liq emas.
 */

import type { Prisma, PrismaClient } from '@prisma/client';

import { db as defaultDb } from '@/lib/db';
import {
  auditCritical,
  isYmd,
  scoreAnswers,
  todayTashkent,
  type Answer,
  type AuditRec,
  type Checkpoint,
  type TaskRec,
} from '@/qc/calc';
import {
  canCreateAudit,
  canDeleteAudit,
  canEditAudit,
  canEditTask,
  canManageDepartments,
  canReadDept,
  deptScope,
  type Actor,
} from '@/qc/policy';
import { diffAnswers, diffDept, joinSummary } from '@/qc/changes';
import { validateAudit, type TaskInput } from '@/qc/validate';

import { logChange } from './log';

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
}

export interface AuditDto extends AuditRec {
  by: string;
  byName: string;
  subject: string;
  notes: Record<string, { text: string; ref: string }>;
  createdAt: string;
  updatedAt: string;
  noCount: number;
  scorePct: number | null;
}

export interface TaskDto extends TaskRec {
  checkNote: string | null;
  checkedByName: string | null;
}

type DeptRow = Prisma.QcDepartmentGetPayload<{ include: { checkpoints: true } }>;

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
      })),
  };
}

type AuditRow = Prisma.QcAuditGetPayload<{ include: { by: { select: { shortName: true } } } }>;

function toAudit(a: AuditRow, checkpoints: Checkpoint[]): AuditDto {
  const answers = a.answers as Record<string, Answer>;
  return {
    id: a.id,
    dept: a.deptId,
    date: a.date,
    by: a.byId,
    byName: a.by.shortName,
    subject: a.subject,
    answers,
    notes: a.notes as AuditDto['notes'],
    critical: a.critical,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    noCount: Object.values(answers).filter((v) => v === 'no').length,
    scorePct: scoreAnswers(answers, checkpoints, a.weights as Record<string, number> | null).pct,
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
    include: { checkpoints: true },
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
      select: { id: true, deptId: true, date: true, answers: true, critical: true, weights: true },
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
  };
  const take = Math.min(Math.max(q.limit ?? PAGE_SIZE, 1), 50_000);
  const skip = Math.max(q.offset ?? 0, 0);
  const client = dbOf(ctx);

  const [rows, total, depts] = await Promise.all([
    client.qcAudit.findMany({
      where,
      include: { by: { select: { shortName: true } } },
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
    include: { by: { select: { shortName: true } }, dept: { include: { checkpoints: true } } },
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
    take: 1000,
  });
  return ok(rows.map(toTask));
}

// ── Tekshiruv yozish ─────────────────────────────────────────────────────────

async function loadDept(client: PrismaClient, id: string): Promise<DeptDto | null> {
  const d = await client.qcDepartment.findUnique({ where: { id }, include: { checkpoints: true } });
  return d ? toDept(d) : null;
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
  const deptId = typeof (body as { dept?: unknown } | null)?.dept === 'string' ? (body as { dept: string }).dept : '';
  const client = dbOf(ctx);
  const dept = deptId ? await loadDept(client, deptId) : null;
  if (!dept) return bad('Bo‘lim topilmadi. Bo‘limni tanlang.');
  if (!dept.active) return bad('Bu bo‘lim faol emas. Boshqa bo‘limni tanlang.');

  const v = validateAudit(body, dept.checkpoints, {
    today: todayTashkent(nowOf(ctx)),
    allowPast: false,
    requireComplete: true,
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
  });
  if (!v.ok) return bad(v.error);
  const d = v.data;
  // Tekshiruvchi sanani o'zgartira olmaydi
  const date = actor.role === 'HEAD' ? d.date : row.date;

  const lines = diffAnswers(row.answers as Record<string, Answer>, d.answers);
  if (date !== row.date) lines.unshift(`Sana: ${row.date} → ${date}`);
  await client.$transaction(async (tx) => {
    await tx.qcAudit.update({
      where: { id },
      data: {
        date,
        answers: d.answers,
        notes: d.notes,
        subject: d.subject,
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
      details: { before: { answers: row.answers, notes: row.notes, subject: row.subject } as object },
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
  checkpoints: Array<{ id?: string; text: string; group?: string | null; weight: number; critical: boolean; active: boolean }>;
}

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
  }
  if (!input.checkpoints.some((c) => c.active)) return bad('Kamida bitta faol nuqta qoldiring.');

  const client = dbOf(ctx);
  const dupe = await client.qcDepartment.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(input.id ? { NOT: { id: input.id } } : {}) },
    select: { id: true },
  });
  if (dupe) return bad('Bunday nomli bo‘lim allaqachon bor. Boshqa nom tanlang.');

  const existing = input.id
    ? await client.qcDepartment.findUnique({ where: { id: input.id }, include: { checkpoints: true } })
    : null;
  if (input.id && !existing) return notFound('Bo‘lim topilmadi.');
  const known = new Set((existing?.checkpoints ?? []).map((c) => c.id));
  for (const c of input.checkpoints) {
    if (c.id && !known.has(c.id)) return bad('Nuqta topilmadi. Sahifani yangilang.');
  }

  const lines = diffDept(existing ? toDept(existing) : null, { ...input, name, checkpoints: input.checkpoints.map((c) => ({ ...c, text: c.text.trim() })) });
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
    for (const [i, c] of input.checkpoints.entries()) {
      const data = {
        text: c.text.trim(),
        grp: c.group?.trim() || null,
        weight: c.weight,
        critical: c.critical,
        active: c.active,
        position: i + 1,
      };
      if (c.id) {
        await tx.qcCheckpoint.update({ where: { deptId_id: { deptId: deptId as string, id: c.id } }, data });
      } else {
        next += 1;
        await tx.qcCheckpoint.create({ data: { ...data, deptId: deptId as string, id: `cp${next}` } });
      }
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

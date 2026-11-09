import type { Checkpoint, DeptDto } from '@/modules/bolimlar/domain';
import { canCreateAudit, canDeleteAudit, canEditAudit, canReadDept, deptScope } from '@/modules/foydalanuvchilar/domain';
import type { Actor } from '@/shared/actor';
import { isListKind } from '@/shared/lists';
import { bad, forbidden, notFound, ok, type Res } from '@/shared/result';
import { joinSummary } from '@/shared/text';
import { isYmd, todayTashkent } from '@/shared/time';

import {
  type Answer,
  type AuditDto,
  auditCritical,
  type AuditQuery,
  diffAnswers,
  PAGE_SIZE,
  type StaffPerson,
  type TaskDto,
  validateAudit,
} from '../domain';

import { toAuditDto } from './mappers';
import type { AuditDeps } from './ports';

const NO_ACCESS = 'Bu bo‘limni ko‘rishga ruxsatingiz yo‘q.';

/** Tekshiruvda tanlash mumkin bo'lgan hodimlar. Ism mijozdan emas — shu ro'yxatdan olinadi. */
function rosterOf(dept: DeptDto, opts: { includeHidden: boolean }): StaffPerson[] {
  return dept.staff.filter((s) => opts.includeHidden || s.active).map((s) => ({ id: s.id, name: s.name }));
}

/** Kiritilgan paytdagi og'irliklar: keyin sozlama o'zgarsa ham tekshiruv bali o'zgarmaydi. */
const freezeWeights = (checkpoints: Checkpoint[]) => Object.fromEntries(checkpoints.map((c) => [c.id, c.weight]));

/** Tekshiruvlar ro'yxati: yangisi birinchi, 50 tadan. */
export async function listAudits(deps: AuditDeps, actor: Actor, q: AuditQuery): Promise<Res<{ rows: AuditDto[]; total: number }>> {
  if (q.dept && !canReadDept(actor, q.dept)) return forbidden(NO_ACCESS);
  if ((q.from && !isYmd(q.from)) || (q.to && !isYmd(q.to))) return bad('Sana noto‘g‘ri: YYYY-MM-DD ko‘rinishida kiriting.');

  const [page, departments] = await Promise.all([
    deps.audits().list(
      { deptId: q.dept ?? deptScope(actor) ?? undefined, from: q.from, to: q.to, list: q.list },
      { take: Math.min(Math.max(q.limit ?? PAGE_SIZE, 1), 50_000), skip: Math.max(q.offset ?? 0, 0) },
    ),
    deps.departments.list(actor, { includeInactive: true }),
  ]);
  const checkpoints = new Map(departments.map((d) => [d.id, d.checkpoints]));
  return ok({ rows: page.rows.map((r) => toAuditDto(r, checkpoints.get(r.deptId) ?? [])), total: page.total });
}

export async function getAudit(
  deps: AuditDeps,
  actor: Actor,
  id: string,
): Promise<Res<{ audit: AuditDto; dept: DeptDto; tasks: TaskDto[]; canEdit: boolean; canDelete: boolean }>> {
  const row = await deps.audits().get(id);
  if (!row) return notFound('Tekshiruv topilmadi. U o‘chirilgan bo‘lishi mumkin.');
  if (!canReadDept(actor, row.deptId)) return forbidden(NO_ACCESS);
  const dept = await deps.departments.find(row.deptId);
  if (!dept) return notFound('Bo‘lim topilmadi.');

  return ok({
    audit: toAuditDto(row, dept.checkpoints),
    dept,
    tasks: await deps.tasks().ofAudit(id),
    canEdit: canEditAudit(actor, { byId: row.byId, createdAt: row.createdAt }, deps.now()),
    canDelete: canDeleteAudit(actor),
  });
}

/**
 * Tekshiruv va unga bog'liq topshiriqlarni BITTA tranzaksiyada saqlaydi (xato bo'lsa hech biri saqlanmaydi).
 * `by`, `createdAt`, `updatedAt`, `critical` ni faqat server qo'yadi — mijozdan kelganlar e'tiborga olinmaydi.
 */
export async function createAudit(deps: AuditDeps, actor: Actor, body: unknown): Promise<Res<{ id: string }>> {
  if (!canCreateAudit(actor)) return forbidden('Tekshiruv kiritish huquqingiz yo‘q.');
  const raw = (body ?? {}) as { dept?: unknown; list?: unknown };
  const deptId = typeof raw.dept === 'string' ? raw.dept : '';
  const list = raw.list === undefined ? 'shift' : raw.list;
  if (!isListKind(list)) return bad('Cheklist noto‘g‘ri.');
  if (!canCreateAudit(actor, { deptId, list })) {
    return forbidden('Bu cheklistni kiritish huquqingiz yo‘q: supervayzer faqat o‘z bo‘limining kunlik smena cheklistini kiritadi.');
  }
  const dept = deptId ? await deps.departments.find(deptId) : null;
  if (!dept) return bad('Bo‘lim topilmadi. Bo‘limni tanlang.');
  if (!dept.active) return bad('Bu bo‘lim faol emas. Boshqa bo‘limni tanlang.');

  const v = validateAudit(body, dept.checkpoints, {
    today: todayTashkent(deps.now()),
    allowPast: false,
    requireComplete: true,
    roster: rosterOf(dept, { includeHidden: false }),
    list,
  });
  if (!v.ok) return bad(v.error);
  const d = v.data;

  const id = await deps.uow.run(async (tx) => {
    const auditId = await deps.audits(tx).create({
      deptId,
      date: d.date,
      byId: actor.id,
      answers: d.answers,
      notes: d.notes,
      subject: d.subject,
      staff: d.staff,
      list: d.list,
      staffId: d.staffId,
      channel: d.channel,
      critical: auditCritical(d.answers, dept.checkpoints),
      weights: freezeWeights(dept.checkpoints),
    });
    await deps.tasks(tx).createMany(auditId, deptId, d.tasks);
    return auditId;
  });
  return ok({ id });
}

/**
 * Tuzatish. Tekshiruvchi — faqat o'zi kiritgan va 24 soat ichida; rahbar — doim (va o'tgan sanaga ham).
 * Ochiq topshiriqlar yangi ro'yxat bilan almashtiriladi; yopilganlar saqlanadi.
 */
export async function updateAudit(deps: AuditDeps, actor: Actor, id: string, body: unknown): Promise<Res<{ id: string }>> {
  const row = await deps.audits().get(id);
  if (!row) return notFound('Tekshiruv topilmadi.');
  if (!canReadDept(actor, row.deptId) || !canEditAudit(actor, { byId: row.byId, createdAt: row.createdAt }, deps.now())) {
    return forbidden('Bu tekshiruvni tuzatish mumkin emas: faqat o‘zingiz kiritgan va 24 soat ichida.');
  }
  const dept = await deps.departments.find(row.deptId);
  if (!dept) return notFound('Bo‘lim topilmadi.');

  const v = validateAudit({ ...(body as object), dept: row.deptId }, dept.checkpoints, {
    today: todayTashkent(deps.now()),
    allowPast: actor.role === 'HEAD',
    requireComplete: false,
    // Tuzatishda yashirilgan hodimlar ham (tekshiruv paytida faol bo'lgan bo'lishi mumkin)
    roster: rosterOf(dept, { includeHidden: true }),
    // Cheklist o'zgarmaydi — tekshiruv qaysi cheklist bilan kiritilgan bo'lsa, shu bilan tuzatiladi
    list: row.list,
  });
  if (!v.ok) return bad(v.error);
  const d = v.data;
  // Tekshiruvchi sanani o'zgartira olmaydi
  const date = actor.role === 'HEAD' ? d.date : row.date;

  const lines = diffAnswers(row.answers as Record<string, Answer>, d.answers);
  if (date !== row.date) lines.unshift(`Sana: ${row.date} → ${date}`);
  if (JSON.stringify(row.staff) !== JSON.stringify(d.staff)) lines.push('hodimlar natijasi o‘zgardi');

  await deps.uow.run(async (tx) => {
    await deps.audits(tx).update(id, {
      date,
      answers: d.answers,
      notes: d.notes,
      subject: d.subject,
      staff: d.staff,
      staffId: d.staffId,
      channel: d.channel,
      critical: auditCritical(d.answers, dept.checkpoints),
      // Og'irliklar birinchi kiritishdagidek qoladi (eski yozuvda bo'lmasa — hozirgidan qotiriladi)
      weights: row.weights ?? freezeWeights(dept.checkpoints),
    });
    await deps.journal(tx).write({
      actorId: actor.id,
      action: 'audit.update',
      entity: 'QcAudit',
      entityId: id,
      summary: `Tekshiruv tuzatildi (${dept.name}, ${row.date}): ${joinSummary(lines)}`,
      details: { before: { answers: row.answers, notes: row.notes, subject: row.subject, staff: row.staff } },
    });
    const tasks = deps.tasks(tx);
    await tasks.deleteOpen(id);
    // Allaqachon yopilgan topshirig'i bor nuqtaga takroran topshiriq ochilmaydi
    const closed = new Set(await tasks.checkpointsWithTasks(id));
    await tasks.createMany(id, row.deptId, d.tasks.filter((t) => !closed.has(t.cp)));
  });
  return ok({ id });
}

export async function deleteAudit(deps: AuditDeps, actor: Actor, id: string): Promise<Res<{ id: string }>> {
  if (!canDeleteAudit(actor)) return forbidden('Tekshiruvni faqat rahbar o‘chira oladi.');
  const row = await deps.audits().get(id);
  if (!row) return notFound('Tekshiruv topilmadi.');
  const deptName = (await deps.departments.find(row.deptId))?.name ?? '';
  const tasks = await deps.tasks().ofAudit(id);

  await deps.uow.run(async (tx) => {
    // Jurnalga to'liq nusxa yoziladi: o'chirilgan tekshiruv izsiz yo'qolmasin
    await deps.journal(tx).write({
      actorId: actor.id,
      action: 'audit.delete',
      entity: 'QcAudit',
      entityId: id,
      summary: `Tekshiruv o‘chirildi (${deptName}, ${row.date}, kiritgan: ${row.byName}, topshiriq: ${tasks.length} ta)`,
      details: {
        dept: deptName,
        date: row.date,
        by: row.byName,
        subject: row.subject,
        critical: row.critical,
        answers: row.answers,
        notes: row.notes,
        weights: row.weights,
        staff: row.staff,
        tasks: tasks.map((t) => ({
          cp: t.cp,
          what: t.what,
          owner: t.owner,
          due: t.due,
          status: t.status === 'open' ? 'OPEN' : 'CLOSED',
          checkNote: t.checkNote,
        })),
      },
    });
    await deps.audits(tx).delete(id); // topshiriqlari bilan (cascade)
  });
  return ok({ id });
}

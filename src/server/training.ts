/**
 * O'quv moduli va haftalik hisobot — server qatlami (ruxsat + ma'lumot).
 *
 * To'g'ri javob (answer, why) test topshirilgunga qadar HECH QAYERDA brauzerga qaytmaydi:
 * `getTest` va `listTraining` faqat `stripAnswers` natijasini beradi, baholashni `submitTest` bajaradi.
 * Foydalanuvchi faqat O'Z yozuviga yozadi: `userId` har doim `actor.id` dan olinadi, so'rovdan emas.
 */

import { Prisma } from '@prisma/client';

import { db as defaultDb } from '@/lib/db';
import { todayTashkent } from '@/qc/calc';
import { canEditReport, canSeeProgress, canSeeReport, canTrain, type Actor } from '@/qc/policy';
import {
  allTaskKeys,
  attemptSummary,
  gradeTest,
  programProgress,
  stripAnswers,
  validateWeek,
  weekRange,
  type Day,
  type GradeResult,
  type PublicQuestion,
  type Question,
  type TrainingStatus,
} from '@/qc/training';

import type { Ctx, Res } from './qc';
import { loadReportForRange, type Report } from './report';

const dbOf = (ctx?: Ctx) => ctx?.db ?? defaultDb;
const ok = <T>(data: T): Res<T> => ({ ok: true, data });
const fail = (status: 400 | 403 | 404 | 409, error: string): Res<never> => ({ ok: false, status, error });
const forbidden = (msg = 'Bu amalga ruxsatingiz yo‘q.') => fail(403, msg);

// ── O'quv dasturi ────────────────────────────────────────────────────────────

export interface TrainingDto {
  deptId: string;
  deptName: string;
  title: string;
  intro: string;
  passPct: number;
  days: Day[];
  questionCount: number;
  /** Xodimning belgilagan topshiriqlari: d1t0, … */
  done: string[];
  progress: { done: number; total: number; complete: boolean };
  attempts: number;
  lastPct: number | null;
  status: TrainingStatus;
}

/** Hamma bo'lim dasturi (testsiz, savollar javobsiz) + joriy xodimning holati. */
export async function listTraining(actor: Actor, ctx?: Ctx): Promise<Res<TrainingDto[]>> {
  if (!canTrain(actor)) return forbidden('O‘quv dasturi sizning rolingiz uchun emas.');
  const client = dbOf(ctx);
  const [rows, tasks, attempts] = await Promise.all([
    client.qcTraining.findMany({
      where: { dept: { active: true } },
      include: { dept: { select: { name: true, position: true } } },
    }),
    client.qcTrainingTask.findMany({ where: { userId: actor.id } }),
    client.qcTrainingAttempt.findMany({ where: { userId: actor.id }, select: { deptId: true, at: true, pct: true, passed: true } }),
  ]);

  const list = rows
    .sort((a, b) => a.dept.position - b.dept.position || a.dept.name.localeCompare(b.dept.name))
    .map<TrainingDto>((t) => {
      const days = t.days as unknown as Day[];
      const done = tasks.filter((x) => x.deptId === t.deptId).map((x) => x.key);
      const sum = attemptSummary(
        attempts.filter((a) => a.deptId === t.deptId).map((a) => ({ at: a.at.toISOString(), pct: a.pct, passed: a.passed })),
      );
      return {
        deptId: t.deptId,
        deptName: t.dept.name,
        title: t.title,
        intro: t.intro,
        passPct: t.passPct,
        days,
        questionCount: (t.questions as unknown as Question[]).length,
        done,
        progress: programProgress(days, done),
        attempts: sum.count,
        lastPct: sum.lastPct,
        status: sum.status,
      };
    });
  return ok(list);
}

export interface TestDto {
  deptId: string;
  deptName: string;
  title: string;
  passPct: number;
  questions: PublicQuestion[];
}

/** Test savollari — answer va why SIZ. */
export async function getTest(actor: Actor, deptId: string, ctx?: Ctx): Promise<Res<TestDto>> {
  if (!canTrain(actor)) return forbidden('Test sizning rolingiz uchun emas.');
  const t = await dbOf(ctx).qcTraining.findUnique({ where: { deptId }, include: { dept: { select: { name: true } } } });
  if (!t) return fail(404, 'Bu bo‘lim uchun o‘quv dasturi topilmadi.');
  const questions = t.questions as unknown as Question[];
  if (questions.length === 0) return fail(404, 'Bu bo‘lim uchun test hali yozilmagan.');
  return ok({ deptId, deptName: t.dept.name, title: t.title, passPct: t.passPct, questions: stripAnswers(questions) });
}

export interface SubmitResult {
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  review: Array<{ id: string; chosen: number; answer: number; why: string; correct: boolean }>;
}

/**
 * Javoblarni yuborish. Tartib: ruxsat → test bor → dastur o'tilgan (409) → baholash (400) → yozish.
 * Baholash va `attempts` ga yozish bir amalda; xato bo'lsa hech narsa yozilmaydi.
 */
export async function submitTest(actor: Actor, deptId: string, answers: unknown, ctx?: Ctx): Promise<Res<SubmitResult>> {
  if (!canTrain(actor)) return forbidden('Test sizning rolingiz uchun emas.');
  const client = dbOf(ctx);
  const t = await client.qcTraining.findUnique({ where: { deptId } });
  if (!t) return fail(404, 'Bu bo‘lim uchun o‘quv dasturi topilmadi.');
  const questions = t.questions as unknown as Question[];
  if (questions.length === 0) return fail(404, 'Bu bo‘lim uchun test hali yozilmagan.');

  const days = t.days as unknown as Day[];
  const done = (await client.qcTrainingTask.findMany({ where: { userId: actor.id, deptId }, select: { key: true } })).map((x) => x.key);
  if (!programProgress(days, done).complete) return fail(409, 'Avval topshiriqlarni bajaring: o‘quv dasturidagi hamma topshiriqni belgilang.');

  const graded: GradeResult = gradeTest(questions, answers, t.passPct);
  if (!graded.ok) return fail(400, graded.error);

  await client.qcTrainingAttempt.create({
    data: {
      userId: actor.id,
      deptId,
      score: graded.score,
      total: graded.total,
      pct: graded.pct,
      passed: graded.passed,
      answers: answers as Prisma.InputJsonObject,
    },
  });
  const { score, total, pct, passed, review } = graded;
  return ok({ score, total, pct, passed, review });
}

/** O'quv topshirig'ini belgilash / olib tashlash — faqat o'z yozuvi. */
export async function setTask(actor: Actor, deptId: string, key: unknown, done: unknown, ctx?: Ctx): Promise<Res<{ key: string; done: boolean }>> {
  if (!canTrain(actor)) return forbidden('O‘quv dasturi sizning rolingiz uchun emas.');
  if (typeof key !== 'string' || typeof done !== 'boolean') return fail(400, 'So‘rov noto‘g‘ri: topshiriq kaliti va holati kerak.');
  const client = dbOf(ctx);
  const t = await client.qcTraining.findUnique({ where: { deptId }, select: { days: true } });
  if (!t) return fail(404, 'Bu bo‘lim uchun o‘quv dasturi topilmadi.');
  if (!allTaskKeys(t.days as unknown as Day[]).includes(key)) return fail(400, 'Bunday topshiriq dasturda yo‘q. Sahifani yangilang.');

  const id = { userId_deptId_key: { userId: actor.id, deptId, key } };
  if (done) {
    await client.qcTrainingTask.upsert({ where: id, create: { userId: actor.id, deptId, key }, update: {} });
  } else {
    await client.qcTrainingTask.deleteMany({ where: { userId: actor.id, deptId, key } });
  }
  return ok({ key, done });
}

// ── Natijalar (rahbar) ───────────────────────────────────────────────────────

export interface AttemptDto {
  id: string;
  at: string;
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  /** Xato qilingan savollar (keys matni) — zaif mavzuni topish uchun. */
  wrong: Array<{ id: string; case: string }>;
}

export interface ProgressRow {
  userId: string;
  userName: string;
  deptId: string | null;
  deptName: string | null;
  done: number;
  total: number;
  status: TrainingStatus;
  lastPct: number | null;
  bestPct: number | null;
  lastAt: string | null;
  attempts: AttemptDto[];
}

/** Hamma xodimlar natijasi (faqat rahbar). Faoliyati bor har (xodim, bo'lim) — bir qator; umuman boshlamagan xodim — bitta qator. */
export async function listProgress(actor: Actor, ctx?: Ctx): Promise<Res<ProgressRow[]>> {
  if (!canSeeProgress(actor)) return forbidden('Natijalarni faqat rahbar ko‘ra oladi.');
  const client = dbOf(ctx);
  const [users, trainings, tasks, attempts] = await Promise.all([
    client.user.findMany({
      where: { active: true, role: { in: ['HEAD', 'INSPECTOR'] } },
      select: { id: true, shortName: true, role: true },
      orderBy: { shortName: 'asc' },
    }),
    client.qcTraining.findMany({ include: { dept: { select: { name: true, position: true } } } }),
    client.qcTrainingTask.findMany({ select: { userId: true, deptId: true, key: true } }),
    client.qcTrainingAttempt.findMany({ orderBy: { at: 'asc' } }),
  ]);

  const byDept = new Map(trainings.map((t) => [t.deptId, t]));
  const rows: ProgressRow[] = [];

  for (const u of users) {
    const pairs = new Set<string>();
    for (const t of tasks) if (t.userId === u.id) pairs.add(t.deptId);
    for (const a of attempts) if (a.userId === u.id) pairs.add(a.deptId);

    if (pairs.size === 0) {
      rows.push({
        userId: u.id,
        userName: u.shortName,
        deptId: null,
        deptName: null,
        done: 0,
        total: 0,
        status: 'none',
        lastPct: null,
        bestPct: null,
        lastAt: null,
        attempts: [],
      });
      continue;
    }

    for (const deptId of pairs) {
      const tr = byDept.get(deptId);
      if (!tr) continue;
      const days = tr.days as unknown as Day[];
      const questions = tr.questions as unknown as Question[];
      const mine = attempts.filter((a) => a.userId === u.id && a.deptId === deptId);
      const sum = attemptSummary(mine.map((a) => ({ at: a.at.toISOString(), pct: a.pct, passed: a.passed })));
      const prog = programProgress(days, tasks.filter((t) => t.userId === u.id && t.deptId === deptId).map((t) => t.key));
      rows.push({
        userId: u.id,
        userName: u.shortName,
        deptId,
        deptName: tr.dept.name,
        done: prog.done,
        total: prog.total,
        status: sum.status,
        lastPct: sum.lastPct,
        bestPct: sum.bestPct,
        lastAt: sum.lastAt,
        attempts: [...mine].reverse().map<AttemptDto>((a) => {
          const given = a.answers as Record<string, number>;
          return {
            id: a.id,
            at: a.at.toISOString(),
            score: a.score,
            total: a.total,
            pct: a.pct,
            passed: a.passed,
            wrong: questions.filter((q) => given[q.id] !== q.answer).map((q) => ({ id: q.id, case: q.case })),
          };
        }),
      });
    }
  }
  return ok(rows);
}

// ── Haftalik hisobot ─────────────────────────────────────────────────────────

export interface WeeklyReport {
  week: string;
  to: string;
  report: Omit<Report, 'period'> & { period?: never };
  note: string;
  noteBy: string | null;
  noteAt: string | null;
  counts: { green: number; yellow: number; red: number; gray: number };
  canEdit: boolean;
}

/** Hafta bo'yicha xom yozuvlar (12 bo'lim) va rahbar izohi. `week` — dushanba, kelajak bo'lmasin. */
export async function getWeeklyReport(actor: Actor, week: unknown, ctx?: Ctx): Promise<Res<WeeklyReport>> {
  if (!canSeeReport(actor)) return forbidden('Haftalik hisobot sizning rolingiz uchun emas.');
  const today = todayTashkent(ctx?.now);
  const v = validateWeek(week, today);
  if (!v.ok) return fail(400, v.error);

  const range = weekRange(v.week);
  const asOf = range.to < today ? range.to : today;
  const rep = await loadReportForRange(actor, range, asOf, undefined, ctx);
  if (!rep.ok) return rep;

  const note = await dbOf(ctx).qcReport.findUnique({ where: { week: v.week }, include: { by: { select: { shortName: true } } } });
  const counts = { green: 0, yellow: 0, red: 0, gray: 0 };
  for (const i of rep.data.items) counts[i.evaluation.status] += 1;

  return ok({
    week: v.week,
    to: range.to,
    report: rep.data as WeeklyReport['report'],
    note: note?.note ?? '',
    noteBy: note?.by.shortName ?? null,
    noteAt: note?.updatedAt.toISOString() ?? null,
    counts,
    canEdit: canEditReport(actor),
  });
}

export const NOTE_MAX = 4000;

/** Rahbar izohini saqlash (faqat rahbar). `by` va vaqtni server qo'yadi. */
export async function saveReportNote(actor: Actor, week: unknown, note: unknown, ctx?: Ctx): Promise<Res<{ week: string }>> {
  if (!canEditReport(actor)) return forbidden('Izohni faqat rahbar yoza oladi.');
  const v = validateWeek(week, todayTashkent(ctx?.now));
  if (!v.ok) return fail(400, v.error);
  if (typeof note !== 'string') return fail(400, 'Izoh matn bo‘lishi kerak.');
  const text = note.trim();
  if (text.length > NOTE_MAX) return fail(400, `Izoh ${NOTE_MAX} belgidan oshmasin.`);
  await dbOf(ctx).qcReport.upsert({
    where: { week: v.week },
    create: { week: v.week, note: text, byId: actor.id },
    update: { note: text, byId: actor.id },
  });
  return ok({ week: v.week });
}

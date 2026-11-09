/**
 * O'quv dasturi, test va natijalar.
 *
 * To'g'ri javob (answer, why) test topshirilgunga qadar HECH QAYERDA brauzerga qaytmaydi:
 * `getTest` va `listTraining` faqat `stripAnswers` natijasini beradi, baholashni `submitTest` bajaradi.
 * Foydalanuvchi faqat O'Z yozuviga yozadi: `userId` har doim `actor.id` dan olinadi, so'rovdan emas.
 */

import { canSeeProgress, canTrain } from '@/modules/foydalanuvchilar/domain';
import type { Actor } from '@/shared/actor';
import { bad, conflict, forbidden, notFound, ok, type Res } from '@/shared/result';

import {
  allTaskKeys,
  type AttemptDto,
  attemptSummary,
  gradeTest,
  programProgress,
  type ProgressRow,
  type SubmitResult,
  stripAnswers,
  type TestDto,
  type TrainingDto,
} from '../domain';

import type { TrainingDeps } from './ports';

const NO_PROGRAM = 'Bu bo‘lim uchun o‘quv dasturi topilmadi.';
const NO_TEST = 'Bu bo‘lim uchun test hali yozilmagan.';
const NOT_FOR_ROLE = 'O‘quv dasturi sizning rolingiz uchun emas.';

/** Hamma bo'lim dasturi (testsiz, savollar javobsiz) + joriy xodimning holati. */
export async function listTraining(deps: TrainingDeps, actor: Actor): Promise<Res<TrainingDto[]>> {
  if (!canTrain(actor)) return forbidden(NOT_FOR_ROLE);
  const [programs, tasks, attempts] = await Promise.all([
    deps.training.programs({ activeOnly: true }),
    deps.training.doneTasks({ userId: actor.id }),
    deps.training.attemptSummaries(actor.id),
  ]);

  const list = [...programs]
    .sort((a, b) => a.deptPosition - b.deptPosition || a.deptName.localeCompare(b.deptName))
    .map<TrainingDto>((t) => {
      const done = tasks.filter((x) => x.deptId === t.deptId).map((x) => x.key);
      const sum = attemptSummary(
        attempts.filter((a) => a.deptId === t.deptId).map((a) => ({ at: a.at.toISOString(), pct: a.pct, passed: a.passed })),
      );
      return {
        deptId: t.deptId,
        deptName: t.deptName,
        title: t.title,
        intro: t.intro,
        passPct: t.passPct,
        days: t.days,
        questionCount: t.questions.length,
        done,
        progress: programProgress(t.days, done),
        attempts: sum.count,
        lastPct: sum.lastPct,
        status: sum.status,
      };
    });
  return ok(list);
}

/** Test savollari — answer va why SIZ. */
export async function getTest(deps: TrainingDeps, actor: Actor, deptId: string): Promise<Res<TestDto>> {
  if (!canTrain(actor)) return forbidden('Test sizning rolingiz uchun emas.');
  const t = await deps.training.program(deptId);
  if (!t) return notFound(NO_PROGRAM);
  if (t.questions.length === 0) return notFound(NO_TEST);
  return ok({ deptId, deptName: t.deptName, title: t.title, passPct: t.passPct, questions: stripAnswers(t.questions) });
}

/**
 * Javoblarni yuborish. Tartib: ruxsat → test bor → dastur o'tilgan (409) → baholash (400) → yozish.
 * Baholash va `attempts` ga yozish bir amalda; xato bo'lsa hech narsa yozilmaydi.
 */
export async function submitTest(deps: TrainingDeps, actor: Actor, deptId: string, answers: unknown): Promise<Res<SubmitResult>> {
  if (!canTrain(actor)) return forbidden('Test sizning rolingiz uchun emas.');
  const t = await deps.training.program(deptId);
  if (!t) return notFound(NO_PROGRAM);
  if (t.questions.length === 0) return notFound(NO_TEST);

  const done = (await deps.training.doneTasks({ userId: actor.id, deptId })).map((x) => x.key);
  if (!programProgress(t.days, done).complete) {
    return conflict('Avval topshiriqlarni bajaring: o‘quv dasturidagi hamma topshiriqni belgilang.');
  }

  const graded = gradeTest(t.questions, answers, t.passPct);
  if (!graded.ok) return bad(graded.error);

  await deps.training.addAttempt({
    userId: actor.id,
    deptId,
    score: graded.score,
    total: graded.total,
    pct: graded.pct,
    passed: graded.passed,
    answers,
  });
  const { score, total, pct, passed, review } = graded;
  return ok({ score, total, pct, passed, review });
}

/** O'quv topshirig'ini belgilash / olib tashlash — faqat o'z yozuvi. */
export async function setTask(
  deps: TrainingDeps,
  actor: Actor,
  deptId: string,
  key: unknown,
  done: unknown,
): Promise<Res<{ key: string; done: boolean }>> {
  if (!canTrain(actor)) return forbidden(NOT_FOR_ROLE);
  if (typeof key !== 'string' || typeof done !== 'boolean') return bad('So‘rov noto‘g‘ri: topshiriq kaliti va holati kerak.');
  const t = await deps.training.program(deptId);
  if (!t) return notFound(NO_PROGRAM);
  if (!allTaskKeys(t.days).includes(key)) return bad('Bunday topshiriq dasturda yo‘q. Sahifani yangilang.');

  await deps.training.markTask(actor.id, deptId, key, done);
  return ok({ key, done });
}

/**
 * Hamma xodimlar natijasi (faqat rahbar). Faoliyati bor har (xodim, bo'lim) — bir qator;
 * umuman boshlamagan xodim — bitta qator.
 */
export async function listProgress(deps: TrainingDeps, actor: Actor): Promise<Res<ProgressRow[]>> {
  if (!canSeeProgress(actor)) return forbidden('Natijalarni faqat rahbar ko‘ra oladi.');
  const [users, programs, tasks, attempts] = await Promise.all([
    deps.reviewers.list(),
    deps.training.programs({ activeOnly: false }),
    deps.training.doneTasks({}),
    deps.training.allAttempts(),
  ]);

  const byDept = new Map(programs.map((t) => [t.deptId, t]));
  const rows: ProgressRow[] = [];

  for (const u of users) {
    const pairs = new Set<string>();
    for (const t of tasks) if (t.userId === u.id) pairs.add(t.deptId);
    for (const a of attempts) if (a.userId === u.id) pairs.add(a.deptId);

    if (pairs.size === 0) {
      rows.push({
        userId: u.id,
        userName: u.name,
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
      const program = byDept.get(deptId);
      if (!program) continue;
      const mine = attempts.filter((a) => a.userId === u.id && a.deptId === deptId);
      const sum = attemptSummary(mine.map((a) => ({ at: a.at.toISOString(), pct: a.pct, passed: a.passed })));
      const prog = programProgress(
        program.days,
        tasks.filter((t) => t.userId === u.id && t.deptId === deptId).map((t) => t.key),
      );
      rows.push({
        userId: u.id,
        userName: u.name,
        deptId,
        deptName: program.deptName,
        done: prog.done,
        total: prog.total,
        status: sum.status,
        lastPct: sum.lastPct,
        bestPct: sum.bestPct,
        lastAt: sum.lastAt,
        attempts: [...mine].reverse().map<AttemptDto>((a) => ({
          id: a.id,
          at: a.at.toISOString(),
          score: a.score,
          total: a.total,
          pct: a.pct,
          passed: a.passed,
          wrong: program.questions.filter((q) => a.answers[q.id] !== q.answer).map((q) => ({ id: q.id, case: q.case })),
        })),
      });
    }
  }
  return ok(rows);
}

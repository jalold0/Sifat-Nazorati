/**
 * O'quv moduli va haftalik hisobot server testlari — haqiqiy PostgreSQL (QC_TEST_DATABASE_URL), `pnpm test:db`.
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { addDays, todayTashkent } from '@/qc/calc';
import type { Actor } from '@/qc/policy';
import { defaultWeek, mondayOf } from '@/qc/training';

import { createAudit, type Ctx } from './qc';
import {
  getTest,
  getWeeklyReport,
  listProgress,
  listTraining,
  saveReportNote,
  setTask,
  submitTest,
} from './training';

const url = process.env.QC_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const QUESTIONS = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i + 1}`,
  case: `Keys ${i + 1}`,
  options: ['A', 'B', 'C', 'D'],
  answer: i % 4,
  why: `SIRLI-SABAB-${i + 1}`,
}));
const DAYS = [
  { title: '1-kun', theory: ['x'], tasks: ['t1', 't2'] },
  { title: '2-kun', theory: ['y'], tasks: ['t3'] },
];
const KEYS = ['d1t0', 'd1t1', 'd2t0'];

suite('o‘quv moduli va hisobot (PostgreSQL)', () => {
  let db: PrismaClient;
  let ctx: Ctx;
  let d1: string;
  let d2: string;
  let head: Actor;
  let insp1: Actor;
  let insp2: Actor;
  let viewer: Actor;
  const today = todayTashkent();

  const right = (n: number) =>
    Object.fromEntries(QUESTIONS.map((q, i) => [q.id, i < n ? q.answer : (q.answer + 1) % 4]));

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.qcLog.deleteMany();
    await db.qcReport.deleteMany();
    await db.qcTrainingAttempt.deleteMany();
    await db.qcTrainingTask.deleteMany();
    await db.qcTraining.deleteMany();
    await db.qcTask.deleteMany();
    await db.qcAudit.deleteMany();
    await db.user.deleteMany();
    await db.qcDepartment.deleteMany();

    const dept = async (name: string, position: number) =>
      (
        await db.qcDepartment.create({
          data: {
            name,
            position,
            checkpoints: { create: [{ id: 'cp1', text: 'Nuqta 1', position: 1, critical: true }, { id: 'cp2', text: 'Nuqta 2', position: 2 }] },
          },
        })
      ).id;
    d1 = await dept('Call center', 1);
    d2 = await dept('Kuryerka', 2);
    await db.qcTraining.create({ data: { deptId: d1, title: 'Call center dasturi', intro: 'x', passPct: 70, days: DAYS, questions: QUESTIONS } });
    await db.qcTraining.create({ data: { deptId: d2, title: 'Kuryerka dasturi', intro: 'y', passPct: 70, days: DAYS, questions: [] } });

    const user = async (key: string, role: 'HEAD' | 'INSPECTOR' | 'VIEWER', deptId?: string) =>
      (await db.user.create({ data: { key, fullName: key, shortName: key, login: key, passwordHash: 'x', role, position: '-', deptId } })).id;
    head = { id: await user('head', 'HEAD'), role: 'HEAD' };
    insp1 = { id: await user('insp1', 'INSPECTOR'), role: 'INSPECTOR' };
    insp2 = { id: await user('insp2', 'INSPECTOR'), role: 'INSPECTOR' };
    viewer = { id: await user('viewer', 'VIEWER', d1), role: 'VIEWER', deptId: d1 };
    ctx = { db };
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('GET training va test javobida answer va why yo‘q', async () => {
    const list = await listTraining(insp1, ctx);
    expect(list.ok).toBe(true);
    const test = await getTest(insp1, d1, ctx);
    expect(test.ok).toBe(true);
    for (const payload of [list, test]) {
      const text = JSON.stringify(payload);
      expect(text).not.toContain('SIRLI-SABAB');
      expect(text).not.toContain('"answer"');
      expect(text).not.toContain('"why"');
    }
    if (test.ok) expect(test.data.questions).toHaveLength(10);
  });

  it('ko‘ruvchi o‘quv va hisobotga 403; tekshiruvchi natijalar jadvaliga 403', async () => {
    expect(await listTraining(viewer, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await getTest(viewer, d1, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await submitTest(viewer, d1, right(10), ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await setTask(viewer, d1, 'd1t0', true, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await getWeeklyReport(viewer, defaultWeek(today), ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await listProgress(insp1, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await listProgress(viewer, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await listProgress(head, ctx)).toMatchObject({ ok: true });
  });

  it('testi yozilmagan bo‘limda 404 va aniq xabar', async () => {
    const r = await getTest(insp1, d2, ctx);
    expect(r).toMatchObject({ ok: false, status: 404 });
    if (!r.ok) expect(r.error).toContain('test hali yozilmagan');
  });

  it('topshiriqlar to‘liq belgilanmagan bo‘lsa submit 409 va hech narsa yozilmaydi', async () => {
    expect(await setTask(insp1, d1, 'd1t0', true, ctx)).toMatchObject({ ok: true });
    const r = await submitTest(insp1, d1, right(10), ctx);
    expect(r).toMatchObject({ ok: false, status: 409 });
    if (!r.ok) expect(r.error).toContain('Avval topshiriqlarni bajaring');
    expect(await db.qcTrainingAttempt.count()).toBe(0);
  });

  it('noma‘lum topshiriq kaliti 400; belgilash qayta bosilsa olib tashlanadi', async () => {
    expect(await setTask(insp1, d1, 'd9t9', true, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await setTask(insp1, d1, 'd1t0', false, ctx)).toMatchObject({ ok: true });
    expect(await db.qcTrainingTask.count({ where: { userId: insp1.id } })).toBe(0);
    for (const k of KEYS) await setTask(insp1, d1, k, true, ctx);
    expect(await db.qcTrainingTask.count({ where: { userId: insp1.id } })).toBe(3);
  });

  it('9 savolga javob → 400, mavjud bo‘lmagan savolId → 400; hech narsa yozilmaydi', async () => {
    const nine = right(10);
    delete (nine as Record<string, number>).q10;
    expect(await submitTest(insp1, d1, nine, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await submitTest(insp1, d1, { ...right(10), nope: 1 }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await db.qcTrainingAttempt.count()).toBe(0);
  });

  it('7 to‘g‘ri → 70% o‘tdi (to‘g‘ri javoblar va tushuntirish qaytadi); ikkinchi urinish — 2 ta yozuv, oxirgisi jadvalda', async () => {
    const first = await submitTest(insp1, d1, right(7), ctx);
    expect(first).toMatchObject({ ok: true, data: { score: 7, total: 10, pct: 70, passed: true } });
    if (first.ok) {
      expect(first.data.review[0]).toMatchObject({ id: 'q1', answer: 0, why: 'SIRLI-SABAB-1' });
    }
    const second = await submitTest(insp1, d1, right(6), ctx);
    expect(second).toMatchObject({ ok: true, data: { pct: 60, passed: false } });

    const rows = await db.qcTrainingAttempt.findMany({ where: { userId: insp1.id } });
    expect(rows).toHaveLength(2);

    const progress = await listProgress(head, ctx);
    if (!progress.ok) throw new Error('progress');
    const mine = progress.data.find((r) => r.userId === insp1.id && r.deptId === d1)!;
    expect(mine).toMatchObject({ done: 3, total: 3, status: 'failed', lastPct: 60, bestPct: 70 });
    expect(mine.attempts).toHaveLength(2);
    // xato qilingan savollar (oxirgi urinish: q7–q10 xato)
    expect(mine.attempts[0]!.wrong.map((w) => w.id)).toEqual(['q7', 'q8', 'q9', 'q10']);
    // boshqa xodim — boshlamagan
    const other = progress.data.find((r) => r.userId === insp2.id)!;
    expect(other).toMatchObject({ status: 'none', deptId: null });
  });

  it('natija faqat sessiyadagi xodimga yoziladi (boshqa xodim yozuvi o‘zgarmaydi)', async () => {
    expect(await db.qcTrainingAttempt.count({ where: { userId: insp2.id } })).toBe(0);
    expect(await db.qcTrainingTask.count({ where: { userId: insp2.id } })).toBe(0);
    // insp2 o'z holatini ko'radi, insp1 natijasi unda yo'q
    const list = await listTraining(insp2, ctx);
    if (!list.ok) throw new Error('list');
    expect(list.data.find((t) => t.deptId === d1)).toMatchObject({ attempts: 0, status: 'none', done: [] });
  });

  it('hafta izohi: faqat rahbar; dushanba bo‘lmasa 400; kelajak haftaga 400; `by`ni server qo‘yadi', async () => {
    const week = defaultWeek(today);
    expect(await saveReportNote(insp1, week, 'izoh', ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await saveReportNote(viewer, week, 'izoh', ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await saveReportNote(head, addDays(week, 1), 'izoh', ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await saveReportNote(head, addDays(mondayOf(today), 7), 'izoh', ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await saveReportNote(head, week, 'x'.repeat(5000), ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await saveReportNote(head, week, '  Ildiz sabab: smena almashinuvi  ', ctx)).toMatchObject({ ok: true });
    expect((await db.qcReport.findUniqueOrThrow({ where: { week } })).byId).toBe(head.id);

    const r = await getWeeklyReport(insp1, week, ctx);
    expect(r).toMatchObject({ ok: true, data: { note: 'Ildiz sabab: smena almashinuvi', canEdit: false } });
    expect(await getWeeklyReport(insp1, addDays(week, 2), ctx)).toMatchObject({ ok: false, status: 400 });
  });

  it('tekshiruv bo‘lmagan haftaning hisoboti xato bermaydi: hamma bo‘lim «ma‘lumot yo‘q»', async () => {
    const r = await getWeeklyReport(head, '2020-01-06', ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.report.items).toHaveLength(2);
    expect(r.data.counts).toEqual({ green: 0, yellow: 0, red: 0, gray: 2 });
  });

  it('hafta hisoboti: shu haftadagi tekshiruv bo‘lim holatiga kiradi', async () => {
    const created = await createAudit(
      insp1,
      { dept: d1, date: today, answers: { cp1: 'no', cp2: 'yes' }, notes: { cp1: { text: 'x', ref: '' } }, tasks: [{ cp: 'cp1', what: 'Tuzatish', owner: 'A', due: today }] },
      ctx,
    );
    expect(created.ok).toBe(true);
    const r = await getWeeklyReport(head, mondayOf(today), ctx);
    if (!r.ok) throw new Error('report');
    const cc = r.data.report.items.find((i) => i.dept.id === d1)!;
    expect(cc.evaluation.auditCount).toBe(1);
    expect(cc.evaluation.status).toBe('red'); // jiddiy nuqtada «Yo'q»
    expect(r.data.counts.red).toBe(1);
  });
});

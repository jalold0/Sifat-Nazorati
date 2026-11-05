import { describe, expect, it } from 'vitest';

import {
  attemptSummary,
  gradeTest,
  isMonday,
  mondayOf,
  programProgress,
  shuffleWithSeed,
  stripAnswers,
  taskKey,
  validateWeek,
  weekRange,
  defaultWeek,
  type Day,
  type Question,
} from './training';

const questions = (n: number): Question[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    case: `Keys ${i + 1}`,
    options: ['A', 'B', 'C', 'D'],
    answer: i % 4,
    why: `Sabab ${i + 1}`,
  }));

/** Birinchi `right` tasi to'g'ri, qolganlari xato javob. */
const answersFor = (qs: Question[], right: number) =>
  Object.fromEntries(qs.map((q, i) => [q.id, i < right ? q.answer : (q.answer + 1) % 4]));

describe('gradeTest', () => {
  it('10 savol, 7 to‘g‘ri → ball 7, 70%, o‘tdi', () => {
    const qs = questions(10);
    const r = gradeTest(qs, answersFor(qs, 7), 70);
    expect(r).toMatchObject({ ok: true, score: 7, total: 10, pct: 70, passed: true });
  });

  it('10 savol, 6 to‘g‘ri → 60%, o‘tmadi', () => {
    const qs = questions(10);
    expect(gradeTest(qs, answersFor(qs, 6), 70)).toMatchObject({ ok: true, pct: 60, passed: false });
  });

  it('pass = 80 bo‘lganda 7 to‘g‘ri → o‘tmadi', () => {
    const qs = questions(10);
    expect(gradeTest(qs, answersFor(qs, 7), 80)).toMatchObject({ ok: true, pct: 70, passed: false });
  });

  it('foiz butun songa yaxlitlanadi (7 savolda 5 to‘g‘ri = 71%)', () => {
    const qs = questions(7);
    expect(gradeTest(qs, answersFor(qs, 5), 70)).toMatchObject({ pct: 71, passed: true });
  });

  it('9 savolga javob (bittasi yo‘q) → 400', () => {
    const qs = questions(10);
    const a = answersFor(qs, 10);
    delete a.q10;
    expect(gradeTest(qs, a, 70)).toMatchObject({ ok: false, status: 400 });
  });

  it('mavjud bo‘lmagan savolId → 400', () => {
    const qs = questions(10);
    expect(gradeTest(qs, { ...answersFor(qs, 10), zz: 0 }, 70)).toMatchObject({ ok: false, status: 400 });
  });

  it('variant indeksi 0–3 dan tashqarida yoki butun emas → 400', () => {
    const qs = questions(2);
    expect(gradeTest(qs, { q1: 4, q2: 0 }, 70)).toMatchObject({ ok: false, status: 400 });
    expect(gradeTest(qs, { q1: -1, q2: 0 }, 70)).toMatchObject({ ok: false, status: 400 });
    expect(gradeTest(qs, { q1: 0.5, q2: 0 }, 70)).toMatchObject({ ok: false, status: 400 });
    expect(gradeTest(qs, { q1: '0', q2: 0 } as never, 70)).toMatchObject({ ok: false, status: 400 });
  });

  it('review: har savol uchun tanlangan, to‘g‘ri javob va tushuntirish', () => {
    const qs = questions(2);
    const r = gradeTest(qs, { q1: 3, q2: 1 }, 70);
    if (!r.ok) throw new Error('ok emas');
    expect(r.review).toEqual([
      { id: 'q1', chosen: 3, answer: 0, why: 'Sabab 1', correct: false },
      { id: 'q2', chosen: 1, answer: 1, why: 'Sabab 2', correct: true },
    ]);
  });

  it('savolsiz test baholanmaydi (400)', () => {
    expect(gradeTest([], {}, 70)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('stripAnswers — to‘g‘ri javob brauzerga ketmaydi', () => {
  it('answer va why maydonlari yo‘q, qolganlari bor', () => {
    const out = stripAnswers(questions(3));
    for (const q of out) {
      expect(Object.keys(q).sort()).toEqual(['case', 'id', 'options']);
    }
    expect(JSON.stringify(out)).not.toContain('Sabab');
  });
});

describe('shuffleWithSeed', () => {
  const opts = ['A', 'B', 'C', 'D'];
  it('bir xil seed — bir xil tartib; asl indekslar saqlanadi (matn bo‘yicha emas)', () => {
    const a = shuffleWithSeed(opts.map((text, index) => ({ text, index })), 'seed-1');
    const b = shuffleWithSeed(opts.map((text, index) => ({ text, index })), 'seed-1');
    expect(a).toEqual(b);
    expect(a.map((x) => x.index).sort()).toEqual([0, 1, 2, 3]);
    for (const x of a) expect(x.text).toBe(opts[x.index]);
  });
  it('turli seed odatda turli tartib', () => {
    const orders = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => shuffleWithSeed([1, 2, 3, 4, 5, 6, 7, 8], s).join('')),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
  it('kirishni o‘zgartirmaydi', () => {
    const src = [1, 2, 3];
    shuffleWithSeed(src, 'x');
    expect(src).toEqual([1, 2, 3]);
  });
});

const days: Day[] = [
  { title: '1-kun', theory: ['a'], tasks: ['t1', 't2'] },
  { title: '2-kun', theory: ['b'], tasks: ['t3'] },
];

describe('programProgress', () => {
  it('kalit shakli d{kun}t{indeks}, kun 1 dan', () => {
    expect(taskKey(1, 0)).toBe('d1t0');
    expect(taskKey(5, 3)).toBe('d5t3');
  });
  it('3 topshiriqdan 2 tasi → 2/3, to‘liq emas', () => {
    expect(programProgress(days, ['d1t0', 'd2t0'])).toEqual({ done: 2, total: 3, complete: false });
  });
  it('noma‘lum kalitlar hisobga olinmaydi, to‘liq bo‘lsa complete', () => {
    expect(programProgress(days, ['d1t0', 'd1t1', 'd2t0', 'd9t9'])).toEqual({ done: 3, total: 3, complete: true });
  });
  it('topshiriqsiz bo‘sh dastur — complete (tugmani to‘smaydi)', () => {
    expect(programProgress([{ title: 'x', theory: [], tasks: [] }], [])).toEqual({ done: 0, total: 0, complete: true });
  });
});

describe('attemptSummary — natijalar jadvali uchun', () => {
  it('urinish yo‘q → boshlamagan', () => {
    expect(attemptSummary([])).toEqual({ status: 'none', lastPct: null, bestPct: null, lastAt: null, count: 0 });
  });
  it('ikkinchi urinish: oxirgisi ko‘rsatiladi, eng yaxshisi ham hisoblanadi', () => {
    const r = attemptSummary([
      { at: '2026-11-02T10:00:00Z', pct: 80, passed: true },
      { at: '2026-11-03T10:00:00Z', pct: 60, passed: false },
    ]);
    expect(r).toEqual({ status: 'failed', lastPct: 60, bestPct: 80, lastAt: '2026-11-03T10:00:00Z', count: 2 });
  });
  it('tartibdan qat‘i nazar oxirgi — eng kech sanali', () => {
    const r = attemptSummary([
      { at: '2026-11-03T10:00:00Z', pct: 90, passed: true },
      { at: '2026-11-02T10:00:00Z', pct: 50, passed: false },
    ]);
    expect(r.status).toBe('passed');
    expect(r.lastPct).toBe(90);
  });
});

describe('hafta (dushanba–yakshanba)', () => {
  it('2026-11-02 — dushanba', () => {
    expect(isMonday('2026-11-02')).toBe(true);
    expect(isMonday('2026-11-03')).toBe(false);
    expect(isMonday('2026-02-31')).toBe(false);
  });
  it('mondayOf: hafta o‘rtasi va yakshanba o‘sha haftaning dushanbasiga qaytadi', () => {
    expect(mondayOf('2026-11-05')).toBe('2026-11-02');
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
  });
  it('weekRange: yakshanbagacha, o‘tgan hafta bilan', () => {
    expect(weekRange('2026-11-02')).toEqual({
      from: '2026-11-02',
      to: '2026-11-08',
      prevFrom: '2026-10-26',
      prevTo: '2026-11-01',
    });
  });
  it('boshlang‘ich hafta — o‘tgan hafta', () => {
    expect(defaultWeek('2026-11-05')).toBe('2026-10-26');
    expect(defaultWeek('2026-11-02')).toBe('2026-10-26');
  });
  it('validateWeek: dushanba bo‘lmasa 400, kelajak hafta 400, joriy hafta ruxsat', () => {
    expect(validateWeek('2026-11-03', '2026-11-05')).toMatchObject({ ok: false });
    expect(validateWeek('abc', '2026-11-05')).toMatchObject({ ok: false });
    expect(validateWeek('2026-11-09', '2026-11-05')).toMatchObject({ ok: false });
    expect(validateWeek('2026-11-02', '2026-11-05')).toEqual({ ok: true, week: '2026-11-02' });
    expect(validateWeek('2026-10-26', '2026-11-05')).toEqual({ ok: true, week: '2026-10-26' });
  });
});

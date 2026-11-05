/**
 * O'quv moduli — SOF funksiyalar: test baholash, dastur o'tilishi, natijalar holati, hafta chegaralari.
 * DB, DOM va tarmoqsiz; to'g'ri javob (answer, why) faqat shu yerda va serverda ishlatiladi —
 * `stripAnswers` brauzerga ketadigan shaklni beradi.
 */

import { addDays, isYmd } from './calc';

export interface Question {
  id: string;
  case: string;
  options: string[];
  /** To'g'ri variant indeksi (0–3). */
  answer: number;
  why: string;
}

export type PublicQuestion = Pick<Question, 'id' | 'case' | 'options'>;

export interface Day {
  title: string;
  theory: string[];
  tasks: string[];
}

export const DEFAULT_PASS = 70;

/** Test topshirilgunga qadar brauzerga to'g'ri javob ketmaydi. */
export function stripAnswers(questions: Question[]): PublicQuestion[] {
  return questions.map((q) => ({ id: q.id, case: q.case, options: [...q.options] }));
}

export interface ReviewItem {
  id: string;
  chosen: number;
  answer: number;
  why: string;
  correct: boolean;
}

export type GradeResult =
  | { ok: true; score: number; total: number; pct: number; passed: boolean; review: ReviewItem[] }
  | { ok: false; status: 400; error: string };

/**
 * Baholash: har to'g'ri javob 1 ball; pct = ball / jami × 100 (butun songa yaxlitlanadi);
 * pct >= pass bo'lsa o'tdi. Hamma savolga javob majburiy; noma'lum savolId yoki yaroqsiz indeks — 400.
 * Variant savolId va ASL indeks bo'yicha tekshiriladi (matn yoki aralashtirilgan tartib bo'yicha emas).
 */
export function gradeTest(questions: Question[], answers: unknown, pass: number = DEFAULT_PASS): GradeResult {
  if (questions.length === 0) return { ok: false, status: 400, error: 'Bu bo‘lim uchun test hali yozilmagan.' };
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { ok: false, status: 400, error: 'Javoblar yuborilmagan.' };
  }
  const given = answers as Record<string, unknown>;
  const known = new Set(questions.map((q) => q.id));
  for (const id of Object.keys(given)) {
    if (!known.has(id)) return { ok: false, status: 400, error: 'Test savollari o‘zgargan. Sahifani yangilab, qayta boshlang.' };
  }
  for (const q of questions) {
    const v = given[q.id];
    if (v === undefined || v === null) {
      return { ok: false, status: 400, error: `Hamma savolga javob bering: ${Object.keys(given).length} / ${questions.length}.` };
    }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= q.options.length) {
      return { ok: false, status: 400, error: 'Javob varianti noto‘g‘ri. Sahifani yangilab, qayta boshlang.' };
    }
  }

  const review = questions.map<ReviewItem>((q) => ({
    id: q.id,
    chosen: given[q.id] as number,
    answer: q.answer,
    why: q.why,
    correct: given[q.id] === q.answer,
  }));
  const score = review.filter((r) => r.correct).length;
  const total = questions.length;
  const pct = Math.round((score / total) * 100);
  return { ok: true, score, total, pct, passed: pct >= pass, review };
}

// ── Variantlarni aralashtirish (brauzer, bir o'tirishda barqaror) ────────────

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 — kichik, deterministik generator. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates; kirishni o'zgartirmaydi, bir xil seed — bir xil natija. */
export function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const out = [...items];
  const rand = rng(hash(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

// ── Dastur o'tilishi ─────────────────────────────────────────────────────────

/** done kaliti: d{kun}t{topshiriq indeksi}; kun 1 dan, indeks 0 dan. */
export const taskKey = (day: number, index: number) => `d${day}t${index}`;

export function allTaskKeys(days: Day[]): string[] {
  return days.flatMap((d, di) => d.tasks.map((_, ti) => taskKey(di + 1, ti)));
}

export function programProgress(days: Day[], doneKeys: string[]) {
  const valid = new Set(allTaskKeys(days));
  const done = new Set(doneKeys.filter((k) => valid.has(k))).size;
  return { done, total: valid.size, complete: done === valid.size };
}

// ── Natijalar jadvali ────────────────────────────────────────────────────────

export interface AttemptLite {
  at: string;
  pct: number;
  passed: boolean;
}

export type TrainingStatus = 'passed' | 'failed' | 'none';

export function attemptSummary(attempts: AttemptLite[]) {
  if (attempts.length === 0) {
    return { status: 'none' as TrainingStatus, lastPct: null, bestPct: null, lastAt: null, count: 0 };
  }
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  const last = sorted[sorted.length - 1] as AttemptLite;
  return {
    status: (last.passed ? 'passed' : 'failed') as TrainingStatus,
    lastPct: last.pct,
    bestPct: Math.max(...attempts.map((a) => a.pct)),
    lastAt: last.at,
    count: attempts.length,
  };
}

// ── Hafta (dushanba–yakshanba) ───────────────────────────────────────────────

/** Haftaning kuni: 0 = dushanba … 6 = yakshanba. */
function weekday(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function isMonday(ymd: string): boolean {
  return isYmd(ymd) && weekday(ymd) === 0;
}

export function mondayOf(ymd: string): string {
  return addDays(ymd, -weekday(ymd));
}

export function weekRange(weekStart: string) {
  return {
    from: weekStart,
    to: addDays(weekStart, 6),
    prevFrom: addDays(weekStart, -7),
    prevTo: addDays(weekStart, -1),
  };
}

/** Boshlang'ich hafta — o'tgan (tugagan) hafta. */
export function defaultWeek(today: string): string {
  return addDays(mondayOf(today), -7);
}

export type WeekValidation = { ok: true; week: string } | { ok: false; status: 400; error: string };

export function validateWeek(week: unknown, today: string): WeekValidation {
  if (typeof week !== 'string' || !isYmd(week)) {
    return { ok: false, status: 400, error: 'Hafta sanasi noto‘g‘ri: YYYY-MM-DD (dushanba) ko‘rinishida kiriting.' };
  }
  if (!isMonday(week)) return { ok: false, status: 400, error: 'Hafta dushanba sanasi bilan beriladi.' };
  if (week > today) return { ok: false, status: 400, error: 'Kelajak haftalar uchun hisobot yo‘q.' };
  return { ok: true, week };
}

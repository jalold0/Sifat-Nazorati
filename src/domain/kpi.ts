/**
 * KPI hisoblash yadrosi.
 *
 * Formulalar manba Excel'dan aynan ko'chirilgan ('KPI kalkulyator' varag'i):
 *   Bajarilish  H = IFERROR(IF(yo'nalish="Yuqori yaxshi"; FAKT/MAQSAD; MAQSAD/FAKT); 0)
 *   Ball        I = OG'IRLIK × MIN(Bajarilish; YUQORI_CHEGARA)
 *   Bonus         = AGAR(JAMI_BALL < KIRISH_CHEGARASI; 0; MAOSH × ULUSH × MIN(JAMI/100; CHEGARA))
 *   Baho          = 110+ A'lo · 95+ Yaxshi · 85+ Qoniqarli · 70+ Past · aks holda Qoniqarsiz
 *
 * Bu fayl freymvork va ma'lumotlar bazasiga bog'liq emas — faqat sonlar bilan ishlaydi.
 */

export type Direction = 'HIGHER_BETTER' | 'LOWER_BETTER';

export interface KpiSettings {
  /** Bonusning maoshdagi ulushi, masalan 0.5 */
  bonusShare: number;
  /** Kirish chegarasi — shu balldan past bo'lsa bonus to'lanmaydi (70) */
  threshold: number;
  /** Yuqori chegara koeffitsienti — bir ko'rsatkich ham, umumiy bonus ham oshmaydi (1.2) */
  cap: number;
}

export const DEFAULT_KPI_SETTINGS: KpiSettings = {
  bonusShare: 0.5,
  threshold: 70,
  cap: 1.2,
};

export interface IndicatorInput {
  code: string;
  name: string;
  /** 0..1 oralig'ida — 0.25 ya'ni 25 ball */
  weight: number;
  direction: Direction;
  target: number;
  /** Oy yakunidagi haqiqiy qiymat. null — hali kiritilmagan */
  fact: number | null;
}

export interface IndicatorResult extends IndicatorInput {
  /** Maqsadga nisbatan bajarilish, 1 = 100% */
  achievement: number;
  /** Chegara qo'llanganidan keyingi ball (og'irlik × min(bajarilish, cap)) */
  score: number;
  /** Maksimal mumkin bo'lgan ball (og'irlik × 100) */
  maxScore: number;
  /** Chegara ishga tushdimi — ya'ni bajarilish cap'dan oshdi */
  capped: boolean;
}

export type Grade = "A'lo" | 'Yaxshi' | 'Qoniqarli' | 'Past' | 'Qoniqarsiz';

const GRADE_SCALE: ReadonlyArray<{ min: number; label: Grade }> = [
  { min: 110, label: "A'lo" },
  { min: 95, label: 'Yaxshi' },
  { min: 85, label: 'Qoniqarli' },
  { min: 70, label: 'Past' },
  { min: Number.NEGATIVE_INFINITY, label: 'Qoniqarsiz' },
];

/**
 * Maqsadga nisbatan bajarilish darajasi.
 * Excel'dagi IFERROR bilan bir xil: nolga bo'linish yoki fakt yo'q bo'lsa — 0.
 */
export function achievementOf(fact: number | null, target: number, direction: Direction): number {
  if (fact === null || !Number.isFinite(fact) || !Number.isFinite(target)) return 0;

  const ratio = direction === 'HIGHER_BETTER' ? fact / target : target / fact;
  if (!Number.isFinite(ratio) || ratio < 0) return 0;
  return ratio;
}

/** Bitta ko'rsatkich bali: og'irlik(0..1) × 100 × min(bajarilish, cap) */
export function scoreOf(weight: number, achievement: number, cap: number): number {
  return weight * 100 * Math.min(achievement, cap);
}

export function evaluateIndicator(input: IndicatorInput, settings: KpiSettings): IndicatorResult {
  const achievement = achievementOf(input.fact, input.target, input.direction);
  return {
    ...input,
    achievement,
    score: scoreOf(input.weight, achievement, settings.cap),
    maxScore: input.weight * 100,
    capped: achievement > settings.cap,
  };
}

export function gradeOf(totalScore: number): Grade {
  // Ro'yxat kamayish tartibida — birinchi mos keluvchi qaytariladi
  return GRADE_SCALE.find((step) => totalScore >= step.min)!.label;
}

/**
 * Bonus summasi. Maosh kiritilmagan bo'lsa 0 (Excel'dagi bo'sh katak bilan bir xil).
 */
export function bonusOf(totalScore: number, salary: number | null, settings: KpiSettings): number {
  if (salary === null || !Number.isFinite(salary) || salary <= 0) return 0;
  if (totalScore < settings.threshold) return 0;
  return salary * settings.bonusShare * Math.min(totalScore / 100, settings.cap);
}

export interface ScorecardInput {
  indicators: IndicatorInput[];
  salary: number | null;
  settings?: KpiSettings;
  /** Sinov rejimida ball hisoblanadi, lekin bonus to'lanmaydi (Joriy etish rejasi, 7-band) */
  trialMode?: boolean;
}

export interface Scorecard {
  indicators: IndicatorResult[];
  /** Og'irliklar yig'indisi — 100 bo'lishi kerak, aks holda pasport noto'g'ri */
  weightTotal: number;
  totalScore: number;
  grade: Grade;
  bonus: number;
  bonusBlockedReason: string | null;
  /** Fakt kiritilmagan ko'rsatkichlar soni */
  missingFacts: number;
  settings: KpiSettings;
}

/** Bir xodimning oylik ballaridan to'liq natija kartasi. */
export function buildScorecard({
  indicators,
  salary,
  settings = DEFAULT_KPI_SETTINGS,
  trialMode = false,
}: ScorecardInput): Scorecard {
  const evaluated = indicators.map((i) => evaluateIndicator(i, settings));
  // Bonus xom (yaxlitlanmagan) balldan hisoblanadi — Excel ham shunday qiladi.
  // Ballni oldin yaxlitlash bonusda so'm farqini beradi.
  const rawTotal = evaluated.reduce((sum, i) => sum + i.score, 0);
  const totalScore = round(rawTotal, 4);
  const weightTotal = round(
    indicators.reduce((sum, i) => sum + i.weight * 100, 0),
    4,
  );

  let bonusBlockedReason: string | null = null;
  if (trialMode) bonusBlockedReason = 'Sinov rejimi — ball hisoblanadi, bonus to‘lanmaydi';
  else if (salary === null || salary <= 0) bonusBlockedReason = 'Maosh kiritilmagan';
  else if (rawTotal < settings.threshold)
    bonusBlockedReason = `Ball kirish chegarasidan past (${settings.threshold})`;

  return {
    indicators: evaluated,
    weightTotal,
    totalScore,
    grade: gradeOf(rawTotal),
    bonus: trialMode ? 0 : round(bonusOf(rawTotal, salary, settings), 2),
    bonusBlockedReason,
    missingFacts: indicators.filter((i) => i.fact === null).length,
    settings,
  };
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

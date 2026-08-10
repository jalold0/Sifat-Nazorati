/**
 * Hisobot davri (oy) bilan ishlash. Davr kodi — "2026-06".
 * Kunlar Asia/Tashkent kalendari bo'yicha sanaladi, DB'da UTC saqlanadi.
 */

import { TZ } from './format';

export const UZ_MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
] as const;

const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isPeriod(value: string): boolean {
  return PERIOD_RE.test(value);
}

export function periodOf(value: Date | string = new Date()): string {
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: TZ,
  }).format(d);
  return parts.slice(0, 7);
}

export function periodLabel(period: string): string {
  const m = PERIOD_RE.exec(period);
  if (!m) return period;
  return `${UZ_MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Davrning boshi va oxiri (UTC Date, yarim ochiq interval: [from, to)). */
export function periodRange(period: string): { from: Date; to: Date } {
  const m = PERIOD_RE.exec(period);
  if (!m) throw new Error(`Davr formati xato: ${period}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(month === 12 ? year + 1 : year, month % 12, 1)),
  };
}

export function shiftPeriod(period: string, months: number): string {
  const m = PERIOD_RE.exec(period);
  if (!m) throw new Error(`Davr formati xato: ${period}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Oxirgi n davr, eng yangisi oxirida. */
export function lastPeriods(count: number, from: string = periodOf()): string[] {
  return Array.from({ length: count }, (_, i) => shiftPeriod(from, i - count + 1));
}

/**
 * Ish kunlari soni — dushanba–shanba (O'zbekistondagi haqiqiy ish tartibi:
 * bo'lim shanba kuni ham ishlaydi, Telegram profilida shanba oqimi ko'rinadi).
 * Bayramlar hisobga olinmaydi — kerak bo'lsa davr sozlamasida qo'lda tuzatiladi.
 */
export function workingDaysIn(period: string): number {
  const { from, to } = periodRange(period);
  let count = 0;
  for (const d = new Date(from); d < to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) count += 1;
  }
  return count;
}

/**
 * Davrning HOZIRGACHA o'tgan ish kunlari.
 * Tugamagan oyda intizom ko'rsatkichini butun oyga bo'lish adolatsiz —
 * xodim hali kelmagan kunlar uchun jazolanadi. Shu sababli oraliq hisobda
 * faqat o'tgan kunlar sanaladi; oy yopilgach natija to'liq oyga teng bo'ladi.
 */
export function workingDaysElapsed(period: string, now: Date = new Date()): number {
  const { from, to } = periodRange(period);
  const today = new Date(`${dayKey(now)}T00:00:00.000Z`);
  const end = today < to ? new Date(today.getTime() + 86_400_000) : to;
  if (end <= from) return 0;

  let count = 0;
  for (const d = new Date(from); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) count += 1;
  }
  return count;
}

/** Kun kodi (YYYY-MM-DD) — reyestr intizomini sanash uchun. */
export function dayKey(value: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ,
  }).format(new Date(value));
}

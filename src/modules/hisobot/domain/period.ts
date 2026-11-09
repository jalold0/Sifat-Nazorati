/**
 * Hisobot davri: Bugun / 7 kun / 30 kun va o'tgan teng davr.
 */

import { addDays } from '@/shared/time';

export type PeriodKey = 'today' | '7' | '30';
export const PERIOD_LABEL: Record<PeriodKey, string> = { today: 'Bugun', '7': '7 kun', '30': '30 kun' };

export interface Range {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

/** Davr chegaralari kiritilgan; o'tgan teng davr — undan oldingi shuncha kun. */
export function periodRange(period: PeriodKey, today: string): Range {
  const days = period === 'today' ? 1 : Number(period);
  const from = addDays(today, -(days - 1));
  return { from, to: today, prevFrom: addDays(from, -days), prevTo: addDays(from, -1) };
}

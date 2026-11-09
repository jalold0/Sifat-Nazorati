/**
 * Hafta (dushanba–yakshanba): chegaralar va tekshirish — SOF.
 */

import { addDays, isYmd } from '@/shared/time';

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

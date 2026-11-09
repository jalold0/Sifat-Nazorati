/**
 * Toshkent (UTC+5) vaqti va YYYY-MM-DD kun yordamchilari — SOF.
 */

const DAY_MS = 86_400_000;
const TASHKENT_OFFSET_MS = 5 * 3_600_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Toshkent vaqti bo'yicha bugungi sana. */
export function todayTashkent(now: Date = new Date()): string {
  const d = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function isYmd(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

export function inRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

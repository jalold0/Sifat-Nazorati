/**
 * SLA va vaqt o'lchovlari.
 *
 * Muhim qoida: barcha vaqtlar UTC'da saqlanadi, ko'rsatishda Asia/Tashkent'ga o'giriladi.
 * SLA "kalendar soat" bo'yicha hisoblanadi — Excel modeli ham shunday
 * (murojaat 24 soat ichida yopilishi kerak, ish kunlari emas).
 */

export const MS_IN_HOUR = 3_600_000;

/** Ikki vaqt orasidagi soat, 2 xona aniqlikda. Manfiy bo'lsa 0. */
export function hoursBetween(from: Date, to: Date): number {
  const diff = (to.getTime() - from.getTime()) / MS_IN_HOUR;
  return diff <= 0 ? 0 : Math.round(diff * 100) / 100;
}

export function minutesBetween(from: Date, to: Date): number {
  const diff = (to.getTime() - from.getTime()) / 60_000;
  return diff <= 0 ? 0 : Math.round(diff * 10) / 10;
}

/** SLA muddati — qabul vaqtidan slaHours keyin. */
export function slaDeadline(receivedAt: Date, slaHours: number): Date {
  return new Date(receivedAt.getTime() + slaHours * MS_IN_HOUR);
}

/**
 * SLA bajarildimi.
 * Yopilmagan murojaat uchun: muddat hali o'tmagan bo'lsa null (aniqlanmagan),
 * o'tgan bo'lsa false — ya'ni "ochiq va kechikkan" holat darhol ko'rinadi.
 */
export function isSlaMet(
  receivedAt: Date,
  closedAt: Date | null,
  slaHours: number,
  now: Date = new Date(),
): boolean | null {
  const deadline = slaDeadline(receivedAt, slaHours);
  if (closedAt) return closedAt.getTime() <= deadline.getTime();
  return now.getTime() > deadline.getTime() ? false : null;
}

/** SLA muddatigacha qolgan soat. Manfiy — kechikish. */
export function hoursToDeadline(receivedAt: Date, slaHours: number, now: Date = new Date()): number {
  const diff = (slaDeadline(receivedAt, slaHours).getTime() - now.getTime()) / MS_IN_HOUR;
  return Math.round(diff * 100) / 100;
}

export type SlaState = 'ON_TIME' | 'AT_RISK' | 'BREACHED' | 'MET' | 'LATE_CLOSED';

/** Murojaatning SLA holati — reyestrda rang bilan ko'rsatiladi. */
export function slaState(
  receivedAt: Date,
  closedAt: Date | null,
  slaHours: number,
  now: Date = new Date(),
): SlaState {
  const deadline = slaDeadline(receivedAt, slaHours);
  if (closedAt) return closedAt.getTime() <= deadline.getTime() ? 'MET' : 'LATE_CLOSED';

  const remaining = (deadline.getTime() - now.getTime()) / MS_IN_HOUR;
  if (remaining < 0) return 'BREACHED';
  // SLA ning oxirgi 25% i — ogohlantirish zonasi
  return remaining <= slaHours * 0.25 ? 'AT_RISK' : 'ON_TIME';
}

/** Eskalatsiya 2 soat ichida bajarildimi (Jasur B. — KPI №8). */
export function escalatedWithin(receivedAt: Date, escalatedAt: Date | null, limitHours = 2): boolean {
  if (!escalatedAt) return false;
  return hoursBetween(receivedAt, escalatedAt) <= limitHours;
}

/** Ish vaqtidan tashqari keldimi (09:00–18:00, Asia/Tashkent). */
export function isOutsideWorkingHours(at: Date, timeZone = 'Asia/Tashkent'): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(at),
  );
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone }).format(at);
  if (weekday === 'Sun') return true;
  return hour < 9 || hour >= 18;
}

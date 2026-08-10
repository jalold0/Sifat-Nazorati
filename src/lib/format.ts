/**
 * Ko'rsatish formatlari — hammasi o'zbek tilida, vaqt zonasi Asia/Tashkent.
 * Pul har doim so'mda va butun songa yaxlitlanadi.
 */

export const TZ = 'Asia/Tashkent';

const NBSP = ' ';

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value)).replace(/\s/g, NBSP)}${NBSP}so'm`;
}

export function number(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace(/\s/g, NBSP);
}

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${number(value * 100, digits)}%`;
}

export function hours(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${number(value, digits)}${NBSP}soat`;
}

export function score(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return number(value, 1);
}

/** KPI birligi bo'yicha avtomatik format. */
export function byUnit(
  value: number | null | undefined,
  unit: 'PERCENT' | 'HOURS' | 'COUNT' | 'RATIO',
): string {
  if (value === null || value === undefined) return '—';
  switch (unit) {
    case 'PERCENT':
      return percent(value);
    case 'HOURS':
      return hours(value);
    case 'COUNT':
      return number(value);
    case 'RATIO':
      return number(value, 2);
  }
}

export function date(value: Date | string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(value));
}

export function dateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(value));
}

export function time(value: Date | string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(value));
}

/** `<input type="date">` uchun YYYY-MM-DD (Toshkent kuni bo'yicha). */
export function dateInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ,
  }).format(new Date(value));
  return parts;
}

/** `<input type="datetime-local">` uchun YYYY-MM-DDTHH:mm. */
export function dateTimeInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  const day = dateInputValue(d);
  const clock = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(d);
  return `${day}T${clock}`;
}

export function relativeDays(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const diff = Math.round((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (diff === 0) return 'bugun';
  if (diff === 1) return 'kecha';
  if (diff < 0) return `${-diff} kundan keyin`;
  return `${diff} kun oldin`;
}

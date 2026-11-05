/**
 * Ko'rsatish formatlari — hammasi o'zbek tilida, vaqt zonasi Asia/Tashkent.
 */

const TZ = 'Asia/Tashkent';

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

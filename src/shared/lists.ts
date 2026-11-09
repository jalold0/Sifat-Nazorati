/**
 * Bo'lim cheklistlari (chastota bo'yicha) va muloqot kanallari — SOF ta'riflar.
 * docs/call-center-cheklist.md: Kunlik smena / Muloqot bahosi / Haftalik tahlil.
 */

export type ListKind = 'shift' | 'interaction' | 'weekly';

export const LIST_ORDER: ListKind[] = ['shift', 'interaction', 'weekly'];

export const LIST_LABEL: Record<ListKind, string> = {
  shift: 'Kunlik smena',
  interaction: 'Muloqot bahosi',
  weekly: 'Haftalik tahlil',
};

/** Tekshiruv ekranida cheklist tagidagi bir jumla: qachon va kim to'ldiradi. */
export const LIST_HINT: Record<ListKind, string> = {
  shift: 'Har smena oxirida, operatorlar kesimida. Odatda supervayzer to‘ldiradi.',
  interaction: 'Bitta qo‘ng‘iroq yoki yozishma, bitta operator. OTK tekshiruvchisi baholaydi.',
  weekly: 'Haftada bir marta: tahlil, hisobot, kalibrlash.',
};

export const CHANNELS = { phone: 'Telefon', telegram: 'Telegram', chat: 'Sayt chati' } as const;
export type Channel = keyof typeof CHANNELS;

export function isChannel(v: unknown): v is Channel {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CHANNELS, v);
}

export const listOf = (v: ListKind | undefined | null): ListKind => v ?? 'shift';

export function isListKind(v: unknown): v is ListKind {
  return v === 'shift' || v === 'interaction' || v === 'weekly';
}

/**
 * Bahoni ko'rsatish qoidalari.
 *
 * Hisob-kitob (`domain/kpi.ts`) Excel bilan aynan bir xil qoladi —
 * bu fayl faqat KO'RSATISHni boshqaradi.
 *
 * Asosiy qoida: ma'lumot umuman yo'q bo'lganda baho ko'rsatilmaydi.
 * "Qoniqarsiz" so'zi xodim nomi yonida baho bo'lib o'qiladi, holbuki hali
 * hech narsa o'lchanmagan. Ball va grafik joyida qoladi (ular 0 ekanini
 * ko'rsatadi), yonidagi "N ko'rsatkichda fakt yo'q" izohi sababni aytadi.
 */

import type { Tone } from '@/components/ui';
import type { Grade, Scorecard } from '@/domain/kpi';

const GRADE_TONE: Record<Grade, Tone> = {
  "A'lo": 'ok',
  Yaxshi: 'ok',
  Qoniqarli: 'warn',
  Past: 'bad',
  Qoniqarsiz: 'bad',
};

export interface GradeBadge {
  label: Grade;
  tone: Tone;
}

/** Baho yorlig'i. Ma'lumot yo'q bo'lsa `null` — yorliq umuman chiqmaydi. */
export function gradeBadge(card: Pick<Scorecard, 'grade' | 'hasNoData'>): GradeBadge | null {
  if (card.hasNoData) return null;
  return { label: card.grade, tone: GRADE_TONE[card.grade] };
}

export { GRADE_TONE };

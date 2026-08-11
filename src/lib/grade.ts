/**
 * Bahoni ko'rsatish qoidalari.
 *
 * Muhim: hisob-kitob (`domain/kpi.ts`) Excel bilan aynan bir xil qoladi —
 * bu fayl faqat KO'RSATISHni boshqaradi. Ma'lumot umuman yo'q bo'lganda
 * "Qoniqarsiz" deb yozish xato bo'ladi: 0 ball "yomon ishladi" degani emas,
 * "hali hech narsa o'lchanmagan" degani.
 */

import type { Grade, Scorecard } from '@/domain/kpi';
import type { Tone } from '@/components/ui';

const GRADE_TONE: Record<Grade, Tone> = {
  "A'lo": 'ok',
  Yaxshi: 'ok',
  Qoniqarli: 'warn',
  Past: 'bad',
  Qoniqarsiz: 'bad',
};

export interface GradeBadge {
  label: string;
  tone: Tone;
  /** Ball ko'rsatilsinmi — ma'lumot yo'q bo'lsa 0,0 chalg'itadi */
  showScore: boolean;
}

export function gradeBadge(card: Pick<Scorecard, 'grade' | 'hasNoData'>): GradeBadge {
  if (card.hasNoData) {
    return { label: "Ma'lumot yo'q", tone: 'neutral', showScore: false };
  }
  return { label: card.grade, tone: GRADE_TONE[card.grade], showScore: true };
}

export { GRADE_TONE };

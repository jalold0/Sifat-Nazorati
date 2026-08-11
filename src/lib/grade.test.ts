import { describe, expect, it } from 'vitest';

import { buildScorecard, type IndicatorInput } from '@/domain/kpi';

import { gradeBadge } from './grade';

const indicator = (fact: number | null): IndicatorInput => ({
  code: 'k',
  name: 'Ko`rsatkich',
  weight: 1,
  direction: 'HIGHER_BETTER',
  target: 1,
  fact,
});

describe('gradeBadge — ma`lumot yo`q holatda baho ko`rsatilmaydi', () => {
  it('hech bir fakt yo`q — yorliq chiqmaydi (null)', () => {
    const card = buildScorecard({ indicators: [indicator(null)], salary: null });
    expect(card.hasNoData).toBe(true);
    expect(gradeBadge(card)).toBe(null);
  });

  it('fakt bor — baho va rangi qaytariladi', () => {
    const card = buildScorecard({ indicators: [indicator(1)], salary: null });
    expect(gradeBadge(card)).toEqual({ label: 'Yaxshi', tone: 'ok' });
  });

  it('yomon natija ham ko`rsatiladi — o`lchov bor, demak baho o`rinli', () => {
    const card = buildScorecard({ indicators: [indicator(0.5)], salary: null });
    expect(gradeBadge(card)).toEqual({ label: 'Qoniqarsiz', tone: 'bad' });
  });

  it('qisman to`ldirilgan karta bahoni ko`rsatadi', () => {
    const card = buildScorecard({
      indicators: [{ ...indicator(1), weight: 0.5 }, { ...indicator(null), weight: 0.5 }],
      salary: null,
    });
    expect(card.hasNoData).toBe(false);
    expect(gradeBadge(card)).not.toBe(null);
  });
});

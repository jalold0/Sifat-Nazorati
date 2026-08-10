import { describe, expect, it } from 'vitest';

import { scoreAudit, verdictOf, type AuditItemSpec } from './checklist';

const ITEMS: AuditItemSpec[] = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, no: i + 1, max: 2 }));

describe('verdictOf — Excel: 90/75/60% pog`onalari', () => {
  it.each([
    [1, 'GOOD'],
    [0.9, 'GOOD'],
    [0.8999, 'ACCEPTABLE'],
    [0.75, 'ACCEPTABLE'],
    [0.7499, 'LOW'],
    [0.6, 'LOW'],
    [0.5999, 'FAIL'],
    [0, 'FAIL'],
  ])('%s → %s', (percent, level) => {
    expect(verdictOf(percent).level).toBe(level);
  });

  it('60% dan past — rahbariyatga eskalatsiya', () => {
    expect(verdictOf(0.5).escalate).toBe(true);
    expect(verdictOf(0.65).escalate).toBe(false);
    expect(verdictOf(0.65).recheck).toBe(true);
  });
});

describe('scoreAudit — 14 band × 2 ball = 28', () => {
  it('to`liq ball: 28/28 = 100%, Yaxshi', () => {
    const r = scoreAudit(ITEMS, ITEMS.map((i) => ({ itemId: i.id, score: 2 })));
    expect(r.totalScore).toBe(28);
    expect(r.maxScore).toBe(28);
    expect(r.percent).toBe(1);
    expect(r.verdict.level).toBe('GOOD');
    expect(r.weakItems).toEqual([]);
  });

  it('javob berilmagan band 0 ball, lekin maksimal ballda qoladi', () => {
    const r = scoreAudit(ITEMS, [{ itemId: 1, score: 2 }]);
    expect(r.totalScore).toBe(2);
    expect(r.maxScore).toBe(28);
    expect(r.percent).toBeCloseTo(0.0714, 4);
    expect(r.verdict.level).toBe('FAIL');
  });

  it('0 va 1 baholar dalil talab qiladi', () => {
    const r = scoreAudit(ITEMS, [
      ...ITEMS.slice(0, 12).map((i) => ({ itemId: i.id, score: 2 })),
      { itemId: 13, score: 1, note: 'Foto: kamera-3 ishlamaydi' },
      { itemId: 14, score: 0 },
    ]);
    expect(r.totalScore).toBe(25);
    expect(r.weakItems).toEqual([13, 14]);
    expect(r.missingEvidence).toEqual([14]);
  });

  it('chegaradan tashqari baho maksimal bilan kesiladi', () => {
    const r = scoreAudit([{ id: 1, no: 1, max: 2 }], [{ itemId: 1, score: 9 }]);
    expect(r.totalScore).toBe(2);
  });

  it('bandsiz shablon xato bermaydi', () => {
    const r = scoreAudit([], []);
    expect(r.percent).toBe(0);
    expect(r.verdict.level).toBe('FAIL');
  });
});

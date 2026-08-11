import { describe, expect, it } from 'vitest';

import {
  achievementOf,
  bonusOf,
  buildScorecard,
  DEFAULT_KPI_SETTINGS,
  gradeOf,
  scoreOf,
  type IndicatorInput,
} from './kpi';

/**
 * Nazorat qiymatlari — manba Excel'ning 'KPI kalkulyator' varag'idan olingan
 * (Iyun 2026 namunasi). Har bir raqam Excel bilan aynan mos kelishi shart.
 */
const EXCEL = {
  ulugbek: {
    salary: 6_000_000,
    total: 83.21992481203009,
    bonus: 2_496_597.744360903,
    grade: 'Past',
    rows: [
      { weight: 0.25, direction: 'HIGHER_BETTER', target: 0.95, fact: 0.9, ach: 0.9473684210526316, score: 23.68421052631579 },
      { weight: 0.2, direction: 'LOWER_BETTER', target: 24, fact: 30, ach: 0.8, score: 16 },
      { weight: 0.2, direction: 'HIGHER_BETTER', target: 14, fact: 10, ach: 0.7142857142857143, score: 14.285714285714286 },
      { weight: 0.2, direction: 'LOWER_BETTER', target: 0.015, fact: 0.02, ach: 0.75, score: 15 },
      { weight: 0.15, direction: 'HIGHER_BETTER', target: 1, fact: 0.95, ach: 0.95, score: 14.25 },
    ],
  },
  jasur: { salary: 6_000_000, total: 81.77631578947368, bonus: 2_453_289.473684211, grade: 'Past' },
  saidali: { salary: 6_000_000, total: 93.32352941176471, bonus: 2_799_705.882352941, grade: 'Qoniqarli' },
  head: { salary: null, total: 86.88888888888889, bonus: 0, grade: 'Qoniqarli' },
} as const;

describe('achievementOf — Excel: IFERROR(IF(yo`nalish="Yuqori yaxshi"; FAKT/MAQSAD; MAQSAD/FAKT); 0)', () => {
  it('yuqori yaxshi: fakt / maqsad', () => {
    expect(achievementOf(0.9, 0.95, 'HIGHER_BETTER')).toBeCloseTo(0.9473684210526316, 12);
  });

  it('past yaxshi: maqsad / fakt', () => {
    expect(achievementOf(30, 24, 'LOWER_BETTER')).toBeCloseTo(0.8, 12);
    expect(achievementOf(0.02, 0.015, 'LOWER_BETTER')).toBeCloseTo(0.75, 12);
  });

  it('maqsaddan yaxshi natija 1 dan katta bajarilish beradi', () => {
    expect(achievementOf(1, 0.9, 'HIGHER_BETTER')).toBeCloseTo(1.1111111, 6);
    expect(achievementOf(1, 2, 'LOWER_BETTER')).toBe(2);
  });

  it('fakt kiritilmagan yoki nolga bo`linish — 0 (IFERROR)', () => {
    expect(achievementOf(null, 0.95, 'HIGHER_BETTER')).toBe(0);
    expect(achievementOf(0, 24, 'LOWER_BETTER')).toBe(0);
    expect(achievementOf(5, 0, 'HIGHER_BETTER')).toBe(0);
  });
});

describe('scoreOf — Excel: OG`IRLIK × MIN(bajarilish; chegara)', () => {
  it('og`irlikni ballga aylantiradi', () => {
    expect(scoreOf(0.25, 0.9473684210526316, 1.2)).toBeCloseTo(23.68421052631579, 10);
  });

  it('yuqori chegara koeffitsientidan oshmaydi', () => {
    // bajarilish 150% bo'lsa ham 1.2 bilan kesiladi
    expect(scoreOf(0.25, 1.5, 1.2)).toBe(30);
    expect(scoreOf(0.25, 1.2, 1.2)).toBe(30);
  });
});

describe('gradeOf — Excel: 110/95/85/70 pog`onalari', () => {
  it.each([
    [115, "A'lo"],
    [110, "A'lo"],
    [109.99, 'Yaxshi'],
    [95, 'Yaxshi'],
    [93.32352941176471, 'Qoniqarli'],
    [86.88888888888889, 'Qoniqarli'],
    [85, 'Qoniqarli'],
    [83.21992481203009, 'Past'],
    [70, 'Past'],
    [69.99, 'Qoniqarsiz'],
    [0, 'Qoniqarsiz'],
  ])('%s ball → %s', (score, expected) => {
    expect(gradeOf(score)).toBe(expected);
  });
});

describe('bonusOf — Excel: AGAR(JAMI < 70; 0; MAOSH × ULUSH × MIN(JAMI/100; 1.2))', () => {
  it('Ulug`bek: 83.22 ball, 6 mln maosh', () => {
    expect(bonusOf(EXCEL.ulugbek.total, EXCEL.ulugbek.salary, DEFAULT_KPI_SETTINGS)).toBeCloseTo(
      EXCEL.ulugbek.bonus,
      6,
    );
  });

  it('Saidali: 93.32 ball', () => {
    expect(bonusOf(EXCEL.saidali.total, EXCEL.saidali.salary, DEFAULT_KPI_SETTINGS)).toBeCloseTo(
      EXCEL.saidali.bonus,
      6,
    );
  });

  it('kirish chegarasidan past — bonus to`lanmaydi', () => {
    expect(bonusOf(69.99, 6_000_000, DEFAULT_KPI_SETTINGS)).toBe(0);
    expect(bonusOf(70, 6_000_000, DEFAULT_KPI_SETTINGS)).toBe(2_100_000);
  });

  it('120 balldan yuqorisi to`lanmaydi (cap 1.2)', () => {
    expect(bonusOf(140, 6_000_000, DEFAULT_KPI_SETTINGS)).toBe(6_000_000 * 0.5 * 1.2);
  });

  it('maosh kiritilmagan — 0', () => {
    expect(bonusOf(EXCEL.head.total, EXCEL.head.salary, DEFAULT_KPI_SETTINGS)).toBe(0);
  });
});

describe('buildScorecard — Ulug`bek M. (Excel bilan qatorlab taqqoslash)', () => {
  const indicators: IndicatorInput[] = EXCEL.ulugbek.rows.map((r, i) => ({
    code: `k${i}`,
    name: `KPI ${i + 1}`,
    weight: r.weight,
    direction: r.direction,
    target: r.target,
    fact: r.fact,
  }));

  const card = buildScorecard({ indicators, salary: EXCEL.ulugbek.salary });

  it('og`irliklar yig`indisi 100 ball', () => {
    expect(card.weightTotal).toBe(100);
  });

  it('har bir qatorning bajarilishi va bali Excel bilan bir xil', () => {
    EXCEL.ulugbek.rows.forEach((row, i) => {
      expect(card.indicators[i]!.achievement).toBeCloseTo(row.ach, 10);
      expect(card.indicators[i]!.score).toBeCloseTo(row.score, 10);
    });
  });

  it('jami ball, baho va bonus Excel bilan bir xil', () => {
    expect(card.totalScore).toBeCloseTo(EXCEL.ulugbek.total, 4);
    expect(card.grade).toBe(EXCEL.ulugbek.grade);
    expect(card.bonus).toBeCloseTo(EXCEL.ulugbek.bonus, 1);
  });

  it('sinov rejimida ball qoladi, bonus nolga tushadi', () => {
    const trial = buildScorecard({ indicators, salary: EXCEL.ulugbek.salary, trialMode: true });
    expect(trial.totalScore).toBeCloseTo(EXCEL.ulugbek.total, 4);
    expect(trial.bonus).toBe(0);
    expect(trial.bonusBlockedReason).toMatch(/Sinov rejimi/);
  });

  it('hech bir faktsiz: hasNoData true — 0 ball "yomon ishladi" degani emas', () => {
    const empty = buildScorecard({
      indicators: indicators.map((i) => ({ ...i, fact: null })),
      salary: EXCEL.ulugbek.salary,
    });
    expect(empty.hasNoData).toBe(true);
    expect(empty.totalScore).toBe(0);
    expect(empty.missingFacts).toBe(indicators.length);
  });

  it('kamida bitta fakt bo`lsa hasNoData false', () => {
    const partial = buildScorecard({
      indicators: indicators.map((i, idx) => (idx === 0 ? i : { ...i, fact: null })),
      salary: EXCEL.ulugbek.salary,
    });
    expect(partial.hasNoData).toBe(false);
  });

  it('to`liq to`ldirilgan kartada hasNoData false', () => {
    expect(card.hasNoData).toBe(false);
  });

  it('ko`rsatkichsiz karta hasNoData bermaydi (bo`sh pasport)', () => {
    expect(buildScorecard({ indicators: [], salary: null }).hasNoData).toBe(false);
  });

  it('fakt kiritilmagan ko`rsatkichlar sanaladi va ball bermaydi', () => {
    const partial = buildScorecard({
      indicators: indicators.map((i, idx) => (idx === 0 ? { ...i, fact: null } : i)),
      salary: EXCEL.ulugbek.salary,
    });
    expect(partial.missingFacts).toBe(1);
    expect(partial.indicators[0]!.score).toBe(0);
    expect(partial.totalScore).toBeCloseTo(EXCEL.ulugbek.total - 23.68421052631579, 4);
  });
});

describe('buildScorecard — qolgan uch xodim', () => {
  it('Jasur B. — 81.78 ball, Past', () => {
    const card = buildScorecard({
      salary: 6_000_000,
      indicators: [
        { code: '1', name: 'Qotib qolgan treklar', weight: 0.25, direction: 'LOWER_BETTER', target: 0.01, fact: 0.018 },
        { code: '2', name: 'Kunlik nazorat', weight: 0.2, direction: 'HIGHER_BETTER', target: 1, fact: 0.95 },
        { code: '3', name: 'Eskalatsiya 2 soat', weight: 0.2, direction: 'HIGHER_BETTER', target: 0.95, fact: 0.88 },
        { code: '4', name: 'Ichki manba yopilishi', weight: 0.2, direction: 'HIGHER_BETTER', target: 0.9, fact: 0.86 },
        { code: '5', name: 'Takroriy ulushi', weight: 0.15, direction: 'LOWER_BETTER', target: 0.15, fact: 0.2 },
      ],
    });
    expect(card.totalScore).toBeCloseTo(EXCEL.jasur.total, 4);
    expect(card.grade).toBe(EXCEL.jasur.grade);
    expect(card.bonus).toBeCloseTo(EXCEL.jasur.bonus, 1);
  });

  it('Saidali Sh. — 93.32 ball, Qoniqarli', () => {
    const card = buildScorecard({
      salary: 6_000_000,
      indicators: [
        { code: '1', name: 'Rasmiy muddat', weight: 0.3, direction: 'HIGHER_BETTER', target: 1, fact: 1 },
        { code: '2', name: 'FCR', weight: 0.2, direction: 'HIGHER_BETTER', target: 0.85, fact: 0.8 },
        { code: '3', name: 'Javob vaqti', weight: 0.2, direction: 'LOWER_BETTER', target: 2, fact: 2.5 },
        { code: '4', name: 'Baholangan chat', weight: 0.15, direction: 'HIGHER_BETTER', target: 200, fact: 180 },
        { code: '5', name: 'Reyestr intizomi', weight: 0.15, direction: 'HIGHER_BETTER', target: 1, fact: 1 },
      ],
    });
    expect(card.totalScore).toBeCloseTo(EXCEL.saidali.total, 4);
    expect(card.grade).toBe(EXCEL.saidali.grade);
  });

  it('Bo`lim boshlig`i — 86.89 ball, maosh yo`q → bonus 0', () => {
    const card = buildScorecard({
      salary: null,
      indicators: [
        { code: '1', name: 'Bo`lim SLA', weight: 0.25, direction: 'HIGHER_BETTER', target: 0.9, fact: 0.86 },
        { code: '2', name: 'Proaktiv ulushi', weight: 0.25, direction: 'HIGHER_BETTER', target: 0.1, fact: 0.06 },
        { code: '3', name: 'Tizimli yechim', weight: 0.2, direction: 'HIGHER_BETTER', target: 2, fact: 2 },
        { code: '4', name: 'Yuklama muvozanati', weight: 0.15, direction: 'LOWER_BETTER', target: 1.3, fact: 1.5 },
        { code: '5', name: 'Kalibrovka', weight: 0.15, direction: 'HIGHER_BETTER', target: 1, fact: 1 },
      ],
    });
    expect(card.totalScore).toBeCloseTo(EXCEL.head.total, 4);
    expect(card.grade).toBe(EXCEL.head.grade);
    expect(card.bonus).toBe(0);
    expect(card.bonusBlockedReason).toBe('Maosh kiritilmagan');
  });
});

import { describe, expect, it } from 'vitest';

import { computeCapacity, deriveNormFromRegistry, type CapacityInputs, type ZoneNorm } from './capacity';

/** 'Quvvat hisobi' varag'idagi May 2026 fakti */
const INPUTS: CapacityInputs = {
  monthlyVolume: 5579,
  workingDays: 21,
  hoursPerDay: 8,
  specialists: 3,
  utilisation: 0.85,
  proactiveShare: 0.2,
};

const NORMS: ZoneNorm[] = [
  { zoneCode: 'A', flowShare: 0.3, minutesPerCase: 6 },
  { zoneCode: 'B', flowShare: 0.4, minutesPerCase: 7 },
  { zoneCode: 'C', flowShare: 0.3, minutesPerCase: 9 },
];

describe('computeCapacity — Excel "Quvvat hisobi" bilan taqqoslash', () => {
  const r = computeCapacity(INPUTS, NORMS);

  it('zonalar bo`yicha murojaat va kerakli soat', () => {
    expect(r.zones[0]!.monthlyCases).toBeCloseTo(1673.7, 1);
    expect(r.zones[0]!.requiredHours).toBeCloseTo(167.37, 2);
    expect(r.zones[1]!.requiredHours).toBeCloseTo(260.35, 2);
    expect(r.zones[2]!.requiredHours).toBeCloseTo(251.06, 2);
  });

  it('mavjud vaqt: nominal 504, foydali 428.4, proaktiv 85.68, reaktiv 342.72', () => {
    expect(r.nominalHours).toBe(504);
    expect(r.usefulHours).toBeCloseTo(428.4, 2);
    expect(r.proactiveHours).toBeCloseTo(85.68, 2);
    expect(r.reactiveAvailableHours).toBeCloseTo(342.72, 2);
  });

  it('kerakli reaktiv vaqt 678.78 soat, taqchillik −336.06', () => {
    expect(r.reactiveRequiredHours).toBeCloseTo(678.78, 1);
    expect(r.balanceHours).toBeCloseTo(-336.06, 1);
  });

  it('yuklama darajasi 198%, kerakli FTE 5.94, qo`shimcha shtat 2.94', () => {
    expect(r.loadFactor).toBeCloseTo(1.9806, 3);
    expect(r.requiredFte).toBeCloseTo(5.94, 2);
    expect(r.extraStaffNeeded).toBeCloseTo(2.94, 2);
  });

  it('oqim ulushlari yig`indisi 1 bo`lgani uchun ogohlantirish yo`q', () => {
    expect(r.flowShareWarning).toBe(false);
  });

  it('ulushlar yig`indisi 1 emas — ogohlantiradi', () => {
    const bad = computeCapacity(INPUTS, [{ zoneCode: 'A', flowShare: 0.5, minutesPerCase: 6 }]);
    expect(bad.flowShareWarning).toBe(true);
  });

  it('proaktiv vaqt himoyalangan: ulush oshsa reaktiv resurs kamayadi', () => {
    const protectedMore = computeCapacity({ ...INPUTS, proactiveShare: 0.4 }, NORMS);
    expect(protectedMore.reactiveAvailableHours).toBeLessThan(r.reactiveAvailableHours);
    expect(protectedMore.loadFactor).toBeGreaterThan(r.loadFactor);
  });
});

describe('deriveNormFromRegistry — xronometraj natijasidan norma chiqarish', () => {
  it('zona bo`yicha o`rtacha daqiqa va oqim ulushini hisoblaydi', () => {
    const norms = deriveNormFromRegistry(
      [
        { zoneCode: 'A', spentHours: 0.1 }, // 6 daq
        { zoneCode: 'A', spentHours: 0.1 },
        { zoneCode: 'B', spentHours: 0.5 }, // 30 daq
        { zoneCode: 'B', spentHours: 0.5 },
      ],
      4,
    );

    expect(norms).toHaveLength(2);
    expect(norms[0]).toMatchObject({ zoneCode: 'A', flowShare: 0.5, minutesPerCase: 6 });
    expect(norms[1]).toMatchObject({ zoneCode: 'B', flowShare: 0.5, minutesPerCase: 30 });
  });

  it('vaqt qayd etilmagan qatorlar normani pasaytiradi, xato bermaydi', () => {
    const norms = deriveNormFromRegistry([{ zoneCode: 'C', spentHours: null }], 1);
    expect(norms[0]!.minutesPerCase).toBe(0);
  });
});

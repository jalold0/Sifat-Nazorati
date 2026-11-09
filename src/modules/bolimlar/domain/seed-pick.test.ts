import { describe, expect, it } from 'vitest';

import { pickCheckpoints } from './seed-pick';


const g = (title: string, n: number) => ({ title, items: Array.from({ length: n }, (_, i) => `${title}${i + 1}`) });

describe('pickCheckpoints', () => {
  it('guruhlardan navbatma-navbat oladi va 8 tadan oshmaydi', () => {
    const r = pickCheckpoints([g('A', 8), g('B', 4), g('C', 3), g('D', 3)]);
    expect(r).toHaveLength(8);
    expect(r.map((c) => c.text)).toEqual(['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2']);
    expect(new Set(r.map((c) => c.group)).size).toBe(4);
  });

  it('id lar cp1, cp2, … — o‘zgarmas tartib; standart: og‘irlik 1, jiddiy emas, faol', () => {
    const r = pickCheckpoints([g('A', 2)]);
    expect(r.map((c) => c.id)).toEqual(['cp1', 'cp2']);
    expect(r[0]).toMatchObject({ weight: 1, critical: false, active: true });
  });

  it('nuqtalar 8 dan kam bo‘lsa hammasi olinadi; qisqa guruh o‘tkazib yuboriladi', () => {
    const r = pickCheckpoints([g('A', 1), g('B', 3)]);
    expect(r.map((c) => c.text)).toEqual(['A1', 'B1', 'B2', 'B3']);
  });

  it('bo‘sh kirish — bo‘sh natija', () => {
    expect(pickCheckpoints([])).toEqual([]);
  });
});

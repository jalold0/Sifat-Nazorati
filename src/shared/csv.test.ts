import { describe, expect, it } from 'vitest';

import { CSV_BOM, toCsv } from '@/shared/csv';


describe('toCsv', () => {
  it('BOM bilan boshlanadi, «;» ajratgich va CRLF', () => {
    const out = toCsv(['Sana', 'Ball'], [['2026-03-10', 75]]);
    expect(out.startsWith(CSV_BOM)).toBe(true);
    expect(out.slice(1)).toBe('Sana;Ball\r\n2026-03-10;75\r\n');
  });

  it('tirnoq, nuqtali vergul va yangi qator o‘ralib, qo‘sh tirnoq ikkilanadi', () => {
    const out = toCsv(['A'], [['a;b'], ['say "hi"'], ['x\ny']]);
    expect(out).toContain('"a;b"');
    expect(out).toContain('"say ""hi"""');
    expect(out).toContain('"x\ny"');
  });

  it('formulaga o‘xshash matn zararsizlantiriladi, raqam (manfiy ham) o‘zgarmaydi', () => {
    const out = toCsv(['A', 'B'], [['=SUM(A1)', -5]]);
    expect(out).toContain("'=SUM(A1)");
    expect(out).toContain(';-5');
  });

  it('bo‘sh qiymatlar bo‘sh katak', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]]).slice(1)).toBe('A;B\r\n;\r\n');
  });
});

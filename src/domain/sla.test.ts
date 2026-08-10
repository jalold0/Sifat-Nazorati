import { describe, expect, it } from 'vitest';

import { escalatedWithin, hoursBetween, isOutsideWorkingHours, isSlaMet, slaState } from './sla';

const at = (iso: string) => new Date(iso);

describe('hoursBetween', () => {
  it('reyestrdagi namuna: 09:15 → 11:40 = 2.42 soat', () => {
    expect(hoursBetween(at('2026-06-02T09:15:00Z'), at('2026-06-02T11:40:00Z'))).toBe(2.42);
  });

  it('teskari tartib 0 beradi', () => {
    expect(hoursBetween(at('2026-06-02T11:40:00Z'), at('2026-06-02T09:15:00Z'))).toBe(0);
  });
});

describe('isSlaMet', () => {
  it('muddat ichida yopilgan — bajarildi', () => {
    expect(isSlaMet(at('2026-06-02T09:00:00Z'), at('2026-06-02T11:00:00Z'), 4)).toBe(true);
  });

  it('muddatdan keyin yopilgan — bajarilmadi', () => {
    expect(isSlaMet(at('2026-06-02T09:00:00Z'), at('2026-06-02T14:00:00Z'), 4)).toBe(false);
  });

  it('aniq muddat chegarasi — bajarildi hisoblanadi', () => {
    expect(isSlaMet(at('2026-06-02T09:00:00Z'), at('2026-06-02T13:00:00Z'), 4)).toBe(true);
  });

  it('ochiq va muddat hali o`tmagan — aniqlanmagan (null)', () => {
    expect(isSlaMet(at('2026-06-02T09:00:00Z'), null, 4, at('2026-06-02T10:00:00Z'))).toBe(null);
  });

  it('ochiq, lekin muddat o`tgan — darhol bajarilmadi', () => {
    expect(isSlaMet(at('2026-06-02T09:00:00Z'), null, 4, at('2026-06-02T15:00:00Z'))).toBe(false);
  });
});

describe('slaState — reyestrdagi rang holati', () => {
  const received = at('2026-06-02T09:00:00Z');

  it('yangi murojaat — muddatida', () => {
    expect(slaState(received, null, 8, at('2026-06-02T10:00:00Z'))).toBe('ON_TIME');
  });

  it('oxirgi 25% — xavf zonasi', () => {
    expect(slaState(received, null, 8, at('2026-06-02T15:30:00Z'))).toBe('AT_RISK');
  });

  it('muddat o`tdi — buzilgan', () => {
    expect(slaState(received, null, 8, at('2026-06-02T18:00:00Z'))).toBe('BREACHED');
  });

  it('yopilgan holatlar', () => {
    expect(slaState(received, at('2026-06-02T12:00:00Z'), 8)).toBe('MET');
    expect(slaState(received, at('2026-06-03T12:00:00Z'), 8)).toBe('LATE_CLOSED');
  });
});

describe('escalatedWithin — KPI №8, 2 soat qoidasi', () => {
  const received = at('2026-06-02T09:00:00Z');

  it('2 soat ichida eskalatsiya qilingan', () => {
    expect(escalatedWithin(received, at('2026-06-02T10:30:00Z'))).toBe(true);
    expect(escalatedWithin(received, at('2026-06-02T11:00:00Z'))).toBe(true);
  });

  it('kechikkan eskalatsiya sanalmaydi', () => {
    expect(escalatedWithin(received, at('2026-06-02T12:00:00Z'))).toBe(false);
  });

  it('umuman eskalatsiya qilinmagan', () => {
    expect(escalatedWithin(received, null)).toBe(false);
  });
});

describe('isOutsideWorkingHours — Asia/Tashkent, 09:00–18:00', () => {
  it('ish vaqti ichida', () => {
    // 2026-06-02 — seshanba; 10:00 Toshkent = 05:00 UTC
    expect(isOutsideWorkingHours(at('2026-06-02T05:00:00Z'))).toBe(false);
  });

  it('kechqurun — tashqarida', () => {
    // 22:00 Toshkent = 17:00 UTC
    expect(isOutsideWorkingHours(at('2026-06-02T17:00:00Z'))).toBe(true);
  });

  it('yakshanba — tashqarida', () => {
    // 2026-06-07 — yakshanba
    expect(isOutsideWorkingHours(at('2026-06-07T07:00:00Z'))).toBe(true);
  });
});

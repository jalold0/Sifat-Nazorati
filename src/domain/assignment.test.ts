import { describe, expect, it } from 'vitest';

import {
  countByAssignment,
  currentWindow,
  resolveOwnerAt,
  SYSTEM_EPOCH,
  validateReassign,
  windowLabel,
  type AssignmentWindow,
} from './assignment';

const d = (iso: string) => new Date(iso);

/** Vazifa №12: avval Ulug'bekda, 12.08.2026 dan Jasurda */
const windows: AssignmentWindow[] = [
  { id: 1, ownerId: 'ulugbek', backupId: 'jasur', from: SYSTEM_EPOCH, until: d('2026-08-12T00:00:00Z') },
  { id: 2, ownerId: 'jasur', backupId: 'saidali', from: d('2026-08-12T00:00:00Z'), until: null },
];

describe('resolveOwnerAt — o`sha paytda kim mas`ul edi', () => {
  it('o`zgarishdan oldin — eski xodim', () => {
    expect(resolveOwnerAt(windows, d('2026-08-11T23:59:59Z'))?.ownerId).toBe('ulugbek');
  });

  it('o`zgarish paytining o`zida — yangi xodim (oraliq yarim ochiq)', () => {
    expect(resolveOwnerAt(windows, d('2026-08-12T00:00:00Z'))?.ownerId).toBe('jasur');
  });

  it('o`zgarishdan keyin — yangi xodim', () => {
    expect(resolveOwnerAt(windows, d('2026-09-01T00:00:00Z'))?.ownerId).toBe('jasur');
  });

  it('tizim boshlanishidan oldin — hech kim', () => {
    expect(resolveOwnerAt(windows, d('2025-01-01T00:00:00Z'))).toBe(null);
  });

  it('birinchi oraliqning boshlanish payti kiritiladi', () => {
    expect(resolveOwnerAt(windows, SYSTEM_EPOCH)?.ownerId).toBe('ulugbek');
  });
});

describe('currentWindow', () => {
  it('yopilmagan oraliqni qaytaradi', () => {
    expect(currentWindow(windows)?.ownerId).toBe('jasur');
  });

  it('hammasi yopilgan bo`lsa null', () => {
    expect(currentWindow([{ ...windows[0]!, until: d('2026-08-12T00:00:00Z') }])).toBe(null);
  });
});

describe('countByAssignment — sanoq o`zgarish sanasida kesiladi', () => {
  it('har bir xodim faqat o`z davridagi ishni oladi', () => {
    const { rows, unassigned } = countByAssignment(windows, [
      d('2026-07-01T10:00:00Z'), // Ulug'bek
      d('2026-08-01T10:00:00Z'), // Ulug'bek
      d('2026-08-11T10:00:00Z'), // Ulug'bek
      d('2026-08-12T09:00:00Z'), // Jasur — o'zgarish kuni
      d('2026-08-20T10:00:00Z'), // Jasur
    ]);

    expect(rows[0]).toMatchObject({ ownerId: 'ulugbek', count: 3 });
    expect(rows[1]).toMatchObject({ ownerId: 'jasur', count: 2 });
    expect(unassigned).toBe(0);
  });

  it('yangi xodimning sanog`i noldan boshlanadi', () => {
    const { rows } = countByAssignment(windows, [d('2026-07-01T10:00:00Z'), d('2026-08-01T10:00:00Z')]);
    expect(rows[0]!.count).toBe(2);
    expect(rows[1]!.count).toBe(0); // Jasur hali hech narsa qilmagan
  });

  it('yig`indi har doim jami murojaat soniga teng', () => {
    const dates = [d('2026-07-01T00:00:00Z'), d('2026-08-15T00:00:00Z'), d('2020-01-01T00:00:00Z')];
    const { rows, unassigned } = countByAssignment(windows, dates);
    expect(rows.reduce((s, r) => s + r.count, 0) + unassigned).toBe(dates.length);
  });

  it('oraliqqa tushmagan murojaat jim yo`qolmaydi', () => {
    const { unassigned } = countByAssignment(windows, [d('2020-01-01T00:00:00Z')]);
    expect(unassigned).toBe(1);
  });

  it('bo`sh ro`yxatda ham xato bermaydi', () => {
    expect(countByAssignment([], [d('2026-08-01T00:00:00Z')])).toEqual({ rows: [], unassigned: 1 });
  });
});

describe('validateReassign', () => {
  const base = {
    currentOwnerId: 'ulugbek',
    currentBackupId: 'jasur',
    newOwnerId: 'saidali',
    newBackupId: 'jasur',
    effectiveFrom: d('2026-08-12T10:00:00Z'),
    currentFrom: SYSTEM_EPOCH,
    activeUserIds: ['ulugbek', 'jasur', 'saidali', 'head'],
    now: d('2026-08-12T12:00:00Z'),
  };

  it('to`g`ri ma`lumot — xato yo`q', () => {
    expect(validateReassign(base)).toBe(null);
  });

  it('faolsiz xodimga biriktirib bo`lmaydi', () => {
    expect(validateReassign({ ...base, newOwnerId: 'ketgan-xodim' })).toMatch(/faol xodimlar/);
  });

  it('zaxira ham faol bo`lishi kerak', () => {
    expect(validateReassign({ ...base, newBackupId: 'ketgan-xodim' })).toMatch(/Zaxira/);
  });

  it('zaxira mas`ul bilan bir xil bo`lmasligi kerak', () => {
    expect(validateReassign({ ...base, newBackupId: 'saidali' })).toMatch(/bir xil/);
  });

  it('o`zgarish bo`lmasa rad etiladi', () => {
    expect(validateReassign({ ...base, newOwnerId: 'ulugbek', newBackupId: 'jasur' })).toMatch(/o'zgarmadi/);
  });

  it('kuchga kirish sanasi joriy oraliq boshidan keyin bo`lishi kerak', () => {
    expect(validateReassign({ ...base, effectiveFrom: SYSTEM_EPOCH })).toMatch(/keyin bo/);
  });

  it('kelasi sanaga biriktirish mumkin emas', () => {
    expect(validateReassign({ ...base, effectiveFrom: d('2026-09-01T00:00:00Z') })).toMatch(/Kelasi sana/);
  });

  it('zaxirasiz biriktirish mumkin (null)', () => {
    expect(validateReassign({ ...base, newBackupId: null })).toBe(null);
  });
});

describe('windowLabel', () => {
  const fmt = (x: Date) => x.toISOString().slice(0, 10);

  it('joriy oraliq', () => {
    expect(windowLabel(windows[1]!, fmt)).toBe('2026-08-12 — hozirgacha');
  });

  it('yopilgan oraliq', () => {
    expect(windowLabel(windows[0]!, fmt)).toBe('2025-11-01 — 2026-08-12');
  });

  it('birinchi oraliq "boshidan" deb ko`rsatiladi', () => {
    expect(windowLabel(windows[0]!, fmt, true)).toBe('boshidan — 2026-08-12');
  });
});

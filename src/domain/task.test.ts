import { describe, expect, it } from 'vitest';

import { canDeleteTask, nextTaskNo, validateAssignee, validateTaskInput, type TaskInput } from './task';

const base: TaskInput = {
  title: 'Kunlik yuk nazorati (CRM) — butun tarmoq kesimida',
  source: 'CRM',
  zoneCode: 'B',
  frequency: 'Kunlik',
  slaHours: 4,
  priority: 'HIGH',
  kind: 'PROACTIVE',
};

describe('validateTaskInput', () => {
  it('to`g`ri ma`lumot — xato yo`q', () => {
    expect(validateTaskInput(base)).toBe(null);
  });

  it('nom juda qisqa', () => {
    expect(validateTaskInput({ ...base, title: 'Yuk' })).toMatch(/qisqa/);
  });

  it('nom 200 belgidan oshmaydi', () => {
    expect(validateTaskInput({ ...base, title: 'a'.repeat(201) })).toMatch(/200 belgidan/);
  });

  it('bo`sh joylar hisobga olinmaydi', () => {
    expect(validateTaskInput({ ...base, title: '   abc   ' })).toMatch(/qisqa/);
  });

  it('manba kiritilmagan', () => {
    expect(validateTaskInput({ ...base, source: '' })).toMatch(/Manba/);
  });

  it('zona kodi noto`g`ri', () => {
    expect(validateTaskInput({ ...base, zoneCode: 'X' })).toMatch(/Zona kodi/);
  });

  it('davriylik ro`yxatdan bo`lishi kerak', () => {
    expect(validateTaskInput({ ...base, frequency: 'Har soatda' })).toMatch(/Davriylik/);
    expect(validateTaskInput({ ...base, frequency: 'Choraklik' })).toBe(null);
  });

  it('ustuvorlik va tur enum bo`yicha tekshiriladi', () => {
    expect(validateTaskInput({ ...base, priority: 'URGENT' })).toMatch(/Ustuvorlik/);
    expect(validateTaskInput({ ...base, kind: 'OTHER' })).toMatch(/Ish turi/);
  });

  describe('SLA', () => {
    it('bo`sh bo`lishi mumkin (proaktiv ishlarda odatiy)', () => {
      expect(validateTaskInput({ ...base, slaHours: null, priority: 'MEDIUM' })).toBe(null);
    });

    it('butun son bo`lishi kerak', () => {
      expect(validateTaskInput({ ...base, slaHours: 2.5 })).toMatch(/butun son/);
    });

    it('kamida 1 soat', () => {
      expect(validateTaskInput({ ...base, slaHours: 0 })).toMatch(/kamida 1 soat/);
    });

    it('720 soatdan oshmaydi', () => {
      expect(validateTaskInput({ ...base, slaHours: 721 })).toMatch(/720 soatdan/);
      expect(validateTaskInput({ ...base, slaHours: 720 })).toBe(null);
    });

    it('kritik vazifada SLA majburiy', () => {
      expect(validateTaskInput({ ...base, priority: 'CRITICAL', slaHours: null })).toMatch(/Kritik/);
      expect(validateTaskInput({ ...base, priority: 'CRITICAL', slaHours: 4 })).toBe(null);
    });
  });
});

describe('validateAssignee', () => {
  const users = ['ulugbek', 'jasur', 'saidali', 'head'];

  it('to`g`ri', () => {
    expect(validateAssignee({ ownerId: 'jasur', backupId: 'saidali', activeUserIds: users })).toBe(null);
  });

  it('zaxirasiz mumkin', () => {
    expect(validateAssignee({ ownerId: 'jasur', backupId: null, activeUserIds: users })).toBe(null);
  });

  it('faolsiz mas`ul rad etiladi', () => {
    expect(validateAssignee({ ownerId: 'ketgan', backupId: null, activeUserIds: users })).toMatch(/Mas'ul/);
  });

  it('faolsiz zaxira rad etiladi', () => {
    expect(validateAssignee({ ownerId: 'jasur', backupId: 'ketgan', activeUserIds: users })).toMatch(/Zaxira/);
  });

  it('zaxira mas`ul bilan bir xil bo`lmaydi', () => {
    expect(validateAssignee({ ownerId: 'jasur', backupId: 'jasur', activeUserIds: users })).toMatch(/bir xil/);
  });
});

describe('nextTaskNo', () => {
  it('bo`sh katalogda 1', () => {
    expect(nextTaskNo([])).toBe(1);
  });

  it('eng katta raqamdan keyingisi', () => {
    expect(nextTaskNo([1, 2, 43])).toBe(44);
  });

  it('tartibsiz ro`yxatda ham to`g`ri ishlaydi', () => {
    expect(nextTaskNo([43, 5, 12])).toBe(44);
  });

  it('o`chirilgan raqam qayta ishlatilmaydi', () => {
    // 3-raqam o'chirilgan bo'lsa ham, yangi vazifa 44 bo'ladi —
    // eski hisobotlardagi raqamlar bilan chalkashmaslik uchun
    expect(nextTaskNo([1, 2, 4, 43])).toBe(44);
  });
});

describe('canDeleteTask', () => {
  it('murojaatsiz va tarixsiz vazifa o`chiriladi', () => {
    expect(canDeleteTask({ tickets: 0, assignments: 1 })).toEqual({ allowed: true, reason: null });
  });

  it('murojaat bo`lsa o`chirilmaydi', () => {
    const r = canDeleteTask({ tickets: 5, assignments: 1 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/5 ta murojaat/);
  });

  it('qayta biriktirilgan vazifa o`chirilmaydi', () => {
    const r = canDeleteTask({ tickets: 0, assignments: 2 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/qayta biriktirilgan/);
  });
});

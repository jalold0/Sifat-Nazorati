import { describe, expect, it } from 'vitest';

import type { Checkpoint } from './calc';
import {
  canCreateAudit,
  canEditReport,
  canSeeProgress,
  canSeeReport,
  canTrain,
  canDeleteAudit,
  canEditAudit,
  canEditTask,
  canManageDepartments,
  canOpenPath,
  canReadDept,
  deptScope,
  homePath,
  navFor,
  type Actor,
} from './policy';
import { validateAudit } from './validate';

const head: Actor = { id: 'h', role: 'HEAD' };
const insp: Actor = { id: 'i1', role: 'INSPECTOR' };
const viewer: Actor = { id: 'v', role: 'VIEWER', deptId: 'd1' };

describe('ruxsatlar', () => {
  it('ko‘ruvchi boshqa bo‘limni o‘qiy olmaydi, o‘zinikini o‘qiydi', () => {
    expect(canReadDept(viewer, 'd1')).toBe(true);
    expect(canReadDept(viewer, 'd2')).toBe(false);
    expect(canReadDept(insp, 'd2')).toBe(true);
    expect(canReadDept(head, 'd2')).toBe(true);
  });

  it('bo‘limi belgilanmagan ko‘ruvchi hech narsa ko‘rmaydi', () => {
    const lost: Actor = { id: 'v2', role: 'VIEWER', deptId: null };
    expect(canReadDept(lost, 'd1')).toBe(false);
    expect(deptScope(lost)).toBe('__none__');
  });

  it('deptScope: rahbar/tekshiruvchi uchun cheklov yo‘q', () => {
    expect(deptScope(head)).toBeNull();
    expect(deptScope(insp)).toBeNull();
    expect(deptScope(viewer)).toBe('d1');
  });

  it('bo‘lim yaratish/o‘zgartirish faqat rahbar', () => {
    expect(canManageDepartments(head)).toBe(true);
    expect(canManageDepartments(insp)).toBe(false);
    expect(canManageDepartments(viewer)).toBe(false);
  });

  it('tekshiruv kiritish: rahbar va tekshiruvchi; ko‘ruvchi yo‘q', () => {
    expect(canCreateAudit(head)).toBe(true);
    expect(canCreateAudit(insp)).toBe(true);
    expect(canCreateAudit(viewer)).toBe(false);
  });

  it('tekshiruvchi faqat o‘zi kiritganini va 24 soat ichida tuzatadi', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    const fresh = { byId: 'i1', createdAt: new Date('2026-03-10T00:00:00Z') };
    const old = { byId: 'i1', createdAt: new Date('2026-03-09T11:59:00Z') };
    const other = { byId: 'i2', createdAt: new Date('2026-03-10T00:00:00Z') };
    expect(canEditAudit(insp, fresh, now)).toBe(true);
    expect(canEditAudit(insp, old, now)).toBe(false);
    expect(canEditAudit(insp, other, now)).toBe(false);
    expect(canEditAudit(head, old, now)).toBe(true);
    expect(canEditAudit(viewer, fresh, now)).toBe(false);
  });

  it('o‘chirish faqat rahbar; topshiriqni tahrirlash — rahbar va tekshiruvchi', () => {
    expect(canDeleteAudit(head)).toBe(true);
    expect(canDeleteAudit(insp)).toBe(false);
    expect(canEditTask(insp)).toBe(true);
    expect(canEditTask(viewer)).toBe(false);
  });

  it('navigatsiya: tekshiruvchiga 5, rahbarga 8, ko‘ruvchiga 1 bo‘lim', () => {
    expect(navFor('INSPECTOR').map((n) => n.label)).toEqual([
      'Tekshiruv',
      'Topshiriqlar',
      'Tarix',
      'O‘quv dasturi',
      'Haftalik hisobot',
    ]);
    expect(navFor('HEAD').map((n) => n.label)).toEqual([
      'Panel',
      'Tekshiruv',
      'Topshiriqlar',
      'Tarix',
      'O‘quv dasturi',
      'Natijalar',
      'Haftalik hisobot',
      'Sozlamalar',
    ]);
    expect(navFor('VIEWER').map((n) => n.label)).toEqual(['Bo‘limim']);
  });

  it('o‘quv va hisobot ruxsatlari: ko‘ruvchiga yo‘q; natijalar va izoh faqat rahbarga', () => {
    expect(canTrain(head) && canTrain(insp)).toBe(true);
    expect(canTrain(viewer)).toBe(false);
    expect(canSeeProgress(head)).toBe(true);
    expect(canSeeProgress(insp)).toBe(false);
    expect(canSeeProgress(viewer)).toBe(false);
    expect(canSeeReport(insp)).toBe(true);
    expect(canSeeReport(viewer)).toBe(false);
    expect(canEditReport(head)).toBe(true);
    expect(canEditReport(insp)).toBe(false);
    expect(canOpenPath('VIEWER', '/oquv/test/abc')).toBe(false);
    expect(canOpenPath('VIEWER', '/hisobot')).toBe(false);
    expect(canOpenPath('INSPECTOR', '/natijalar')).toBe(false);
    expect(canOpenPath('INSPECTOR', '/oquv/test/abc')).toBe(true);
  });

  it('boshlang‘ich ekran: tekshiruvchida Tekshiruv, rahbarda Panel, ko‘ruvchida Bo‘limim', () => {
    expect(homePath('INSPECTOR')).toBe('/tekshiruv');
    expect(homePath('HEAD')).toBe('/panel');
    expect(homePath('VIEWER')).toBe('/bolimim');
  });

  it('sahifa yo‘li: qo‘lda manzil kiritib ham ruxsatsiz ekranga kirib bo‘lmaydi', () => {
    expect(canOpenPath('VIEWER', '/panel')).toBe(false);
    expect(canOpenPath('VIEWER', '/tarix')).toBe(false);
    expect(canOpenPath('VIEWER', '/bolimim')).toBe(true);
    expect(canOpenPath('INSPECTOR', '/sozlamalar')).toBe(false);
    expect(canOpenPath('INSPECTOR', '/tekshiruv')).toBe(true);
    expect(canOpenPath('HEAD', '/sozlamalar')).toBe(true);
  });
});

const cps: Checkpoint[] = [1, 2, 3].map((i) => ({
  id: `cp${i}`,
  text: `Nuqta ${i}`,
  weight: 1,
  critical: false,
  active: true,
}));
const TODAY = '2026-03-10';
const opts = { today: TODAY, allowPast: false, requireComplete: true };

const good = () => ({
  dept: 'd1',
  date: TODAY,
  answers: { cp1: 'yes', cp2: 'no', cp3: 'na' },
  notes: { cp2: { text: 'Skript buzilgan', ref: 'M-1' } },
  tasks: [{ cp: 'cp2', what: 'Qayta o‘qitish', owner: 'Aziz', due: '2026-03-11' }],
});

describe('validateAudit — server majburiy qiladigan qoidalar', () => {
  it('to‘g‘ri tekshiruv o‘tadi va ma‘lumot tozalanadi', () => {
    const r = validateAudit({ ...good(), subject: '  Operator 5  ' }, cps, opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.subject).toBe('Operator 5');
      expect(r.data.notes.cp2).toEqual({ text: 'Skript buzilgan', ref: 'M-1' });
      expect(r.data.tasks).toHaveLength(1);
    }
  });

  it('«Yo‘q» javobga izoh bo‘lmasa — xato', () => {
    const b = good();
    b.notes = {} as never;
    const r = validateAudit(b, cps, opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('izoh majburiy');
  });

  it('«Yo‘q» javobga topshiriq bo‘lmasa — xato', () => {
    const b = good();
    b.tasks = [];
    const r = validateAudit(b, cps, opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('topshiriq kerak');
  });

  it('kelajak sana — xato; o‘tgan sana — faqat ruxsat berilganda', () => {
    expect(validateAudit({ ...good(), date: '2026-03-11' }, cps, opts).ok).toBe(false);
    expect(validateAudit({ ...good(), date: '2026-03-09' }, cps, opts).ok).toBe(false);
    const past = good();
    past.date = '2026-03-09';
    expect(validateAudit(past, cps, { ...opts, allowPast: true }).ok).toBe(true);
  });

  it('noto‘g‘ri sana formati — xato', () => {
    expect(validateAudit({ ...good(), date: '10.03.2026' }, cps, opts).ok).toBe(false);
    expect(validateAudit({ ...good(), date: '2026-02-31' }, cps, opts).ok).toBe(false);
  });

  it('nofaol yoki begona nuqta kaliti — xato', () => {
    const list = cps.map((c) => (c.id === 'cp3' ? { ...c, active: false } : c));
    const b = good();
    expect(validateAudit(b, list, opts).ok).toBe(false); // cp3 nofaol
    const b2 = good();
    (b2.answers as Record<string, string>).zz = 'yes';
    expect(validateAudit(b2, cps, opts).ok).toBe(false);
  });

  it('tanlanmagan nuqta bo‘lsa saqlab bo‘lmaydi', () => {
    const b = good();
    delete (b.answers as Record<string, string>).cp3;
    const r = validateAudit(b, cps, opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Barcha nuqtalarni belgilang');
    expect(validateAudit(b, cps, { ...opts, requireComplete: false }).ok).toBe(true);
  });

  it('noto‘g‘ri javob qiymati — xato', () => {
    const b = good();
    (b.answers as Record<string, string>).cp1 = 'maybe';
    expect(validateAudit(b, cps, opts).ok).toBe(false);
  });

  it('topshiriq: nima/mas‘ul/muddat majburiy; muddat tekshiruvdan oldin bo‘lmaydi; «Yo‘q» bo‘lmagan nuqtaga bo‘lmaydi', () => {
    const noWhat = good();
    noWhat.tasks = [{ cp: 'cp2', what: ' ', owner: 'A', due: '2026-03-11' }];
    expect(validateAudit(noWhat, cps, opts).ok).toBe(false);
    const noOwner = good();
    noOwner.tasks = [{ cp: 'cp2', what: 'x', owner: '', due: '2026-03-11' }];
    expect(validateAudit(noOwner, cps, opts).ok).toBe(false);
    const early = good();
    early.tasks = [{ cp: 'cp2', what: 'x', owner: 'A', due: '2026-03-09' }];
    expect(validateAudit(early, cps, opts).ok).toBe(false);
    const wrongCp = good();
    wrongCp.tasks = [...wrongCp.tasks, { cp: 'cp1', what: 'x', owner: 'A', due: '2026-03-11' }];
    expect(validateAudit(wrongCp, cps, opts).ok).toBe(false);
  });

  it('mijoz yuborgan by/created/critical kabi maydonlar natijaga o‘tmaydi', () => {
    const r = validateAudit({ ...good(), by: 'hacker', created: 1, critical: true }, cps, opts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.data).sort()).toEqual(['answers', 'date', 'dept', 'notes', 'subject', 'tasks']);
  });

  it('bo‘sh/buzuq tana — xato, istisno chiqmaydi', () => {
    expect(validateAudit(null, cps, opts).ok).toBe(false);
    expect(validateAudit('x', cps, opts).ok).toBe(false);
    expect(validateAudit({}, cps, opts).ok).toBe(false);
  });
});

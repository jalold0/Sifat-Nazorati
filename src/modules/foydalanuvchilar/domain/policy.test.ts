import { describe, expect, it } from 'vitest';

import { canCreateAudit, canDeleteAudit, canEditAudit, canEditReport, canEditTask, canManageDepartments, canOpenPath, canReadDept, canSeeProgress, canSeeReport, canTrain, deptScope, homePath, navFor } from './policy';
import type { Actor } from '@/shared/actor';


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

import { describe, expect, it } from 'vitest';

import { type DeptEdit, type DeptSnapshot, diffDept } from './changes';
import { diffAnswers } from '@/modules/auditlar/domain';
import { joinSummary } from '@/shared/text';


const before: DeptSnapshot = {
  name: 'Call center',
  norm: 90,
  estimate: true,
  active: true,
  checkpoints: [
    { id: 'cp1', text: 'Birinchi savolmi?', weight: 1, critical: false, active: true },
    { id: 'cp2', text: 'Ikkinchi savolmi?', weight: 1, critical: false, active: true },
  ],
};

const same = (): DeptEdit => ({
  name: before.name,
  norm: before.norm,
  estimate: before.estimate,
  active: before.active,
  checkpoints: before.checkpoints.map((c) => ({ ...c })),
});

describe('diffDept', () => {
  it('o‘zgarish yo‘q — bo‘sh', () => {
    expect(diffDept(before, same())).toEqual([]);
  });

  it('me‘yor, tasdiqlash, og‘irlik, jiddiy va yashirish alohida satrlarda', () => {
    const after = same();
    after.norm = 85;
    after.estimate = false;
    after.checkpoints[0]!.weight = 3;
    after.checkpoints[0]!.critical = true;
    after.checkpoints[1]!.active = false;
    expect(diffDept(before, after)).toEqual([
      'Me‘yor: 90% → 85%',
      'Me‘yor tasdiqlandi',
      'Nuqta cp1: og‘irlik 1 → 3',
      'Nuqta cp1: jiddiy belgisi qo‘yildi',
      'Nuqta cp2: yashirildi',
    ]);
  });

  it('matn o‘zgarishi va yangi nuqta', () => {
    const after = same();
    after.checkpoints[0]!.text = 'Yangi matnmi?';
    after.checkpoints.push({ text: 'Qo‘shilgan nuqtami?', weight: 2, critical: true, active: true });
    const lines = diffDept(before, after);
    expect(lines[0]).toContain('Nuqta cp1: matn o‘zgardi');
    expect(lines[1]).toBe('Yangi nuqta: «Qo‘shilgan nuqtami?» (jiddiy), og‘irlik 2');
  });

  it('yangi bo‘lim', () => {
    expect(diffDept(null, same())[0]).toBe('Yangi bo‘lim: «Call center», me‘yor 90%, 2 ta faol nuqta');
  });

  it('uzun matn qisqartiriladi', () => {
    const after = same();
    after.checkpoints.push({ text: 'x'.repeat(200), weight: 1, critical: false, active: true });
    expect(diffDept(before, after).at(-1)!.length).toBeLessThan(120);
  });
});

describe('diffAnswers / joinSummary', () => {
  it('faqat o‘zgargan javoblar', () => {
    expect(diffAnswers({ cp1: 'yes', cp2: 'no' }, { cp1: 'yes', cp2: 'yes', cp3: 'na' })).toEqual([
      'cp2: Yo‘q → Ha',
      'cp3: — → Tegishli emas',
    ]);
  });
  it('bo‘sh ro‘yxat uchun zaxira matn', () => {
    expect(joinSummary([])).toBe('o‘zgarish yo‘q');
    expect(joinSummary(['a', 'b'])).toBe('a; b');
  });
});

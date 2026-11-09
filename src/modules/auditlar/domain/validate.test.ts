import { describe, expect, it } from 'vitest';

import { validateAudit } from './validate';
import type { Checkpoint } from '@/modules/bolimlar/domain';


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
    if (r.ok) expect(Object.keys(r.data).sort()).toEqual(['answers', 'channel', 'date', 'dept', 'list', 'notes', 'staff', 'staffId', 'subject', 'tasks']);
    // hodimli nuqta yo'q bo'limda hodim bloki bo'lmaydi
    if (r.ok) expect(r.data.staff).toBeNull();
  });

  it('bo‘sh/buzuq tana — xato, istisno chiqmaydi', () => {
    expect(validateAudit(null, cps, opts).ok).toBe(false);
    expect(validateAudit('x', cps, opts).ok).toBe(false);
    expect(validateAudit({}, cps, opts).ok).toBe(false);
  });
});

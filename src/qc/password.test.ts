import { describe, expect, it } from 'vitest';

import { createThrottle, validateNewPassword } from './password';

const ctx = { login: 'jasur' };

describe('validateNewPassword', () => {
  it('yaxshi parol o‘tadi', () => {
    expect(validateNewPassword('Qizil-Olma7', ctx)).toEqual({ ok: true });
  });
  it('qisqa, harfsiz/raqamsiz, loginga teng — rad', () => {
    expect(validateNewPassword('Ab1', ctx).ok).toBe(false);
    expect(validateNewPassword('faqatharflar', ctx).ok).toBe(false);
    expect(validateNewPassword('123456789012', ctx).ok).toBe(false);
    expect(validateNewPassword('jasur', { login: 'jasur' }).ok).toBe(false);
  });
  it('boshlang‘ich va oddiy parollarga qaytib bo‘lmaydi', () => {
    expect(validateNewPassword('Otk2026!', ctx).ok).toBe(false);
    expect(validateNewPassword('password', ctx).ok).toBe(false);
  });
  it('eski parol bilan bir xil yoki takrori mos emas — rad', () => {
    expect(validateNewPassword('Qizil-Olma7', { ...ctx, current: 'Qizil-Olma7' }).ok).toBe(false);
    expect(validateNewPassword('Qizil-Olma7', { ...ctx, confirm: 'Qizil-Olma8' }).ok).toBe(false);
    expect(validateNewPassword('Qizil-Olma7', { ...ctx, current: 'Eski-Parol1', confirm: 'Qizil-Olma7' }).ok).toBe(true);
  });
});

describe('createThrottle', () => {
  const opts = { max: 3, windowMs: 60_000, lockMs: 120_000 };

  it('max muvaffaqiyatsiz urinishdan keyin qulflaydi, qolgan soniyani aytadi', () => {
    const t = createThrottle(opts);
    t.fail('a', 0);
    t.fail('a', 1000);
    expect(t.retryAfter('a', 1500)).toBe(0);
    t.fail('a', 2000);
    expect(t.retryAfter('a', 2000)).toBe(120);
    expect(t.retryAfter('a', 62_000)).toBe(60);
  });

  it('qulf muddati o‘tgach ochiladi va sanoq qaytadan boshlanadi', () => {
    const t = createThrottle(opts);
    for (const n of [0, 1, 2]) t.fail('a', n);
    expect(t.retryAfter('a', 130_000)).toBe(0);
    t.fail('a', 130_000);
    expect(t.retryAfter('a', 130_001)).toBe(0);
  });

  it('oyna tashqarisidagi eski urinishlar hisobga olinmaydi', () => {
    const t = createThrottle(opts);
    t.fail('a', 0);
    t.fail('a', 1000);
    t.fail('a', 100_000); // 2 ta eskirgan
    expect(t.retryAfter('a', 100_000)).toBe(0);
  });

  it('muvaffaqiyatli kirish sanoqni tozalaydi; kalitlar bir-biriga ta‘sir qilmaydi', () => {
    const t = createThrottle(opts);
    t.fail('a', 0);
    t.fail('a', 1);
    t.reset('a');
    t.fail('a', 2);
    expect(t.retryAfter('a', 3)).toBe(0);
    for (const n of [0, 1, 2]) t.fail('b', n);
    expect(t.retryAfter('b', 3)).toBeGreaterThan(0);
    expect(t.retryAfter('a', 3)).toBe(0);
  });
});

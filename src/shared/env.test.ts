import { afterEach, describe, expect, it } from 'vitest';

import { env, resetEnvForTests } from './env';

const OLD = { ...process.env };
const set = (vars: Record<string, string | undefined>) => {
  process.env = { ...OLD, ...vars } as NodeJS.ProcessEnv;
  resetEnvForTests();
};

afterEach(() => {
  process.env = { ...OLD };
  resetEnvForTests();
});

const GOOD = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', AUTH_SECRET: 'x'.repeat(32) };

describe('env()', () => {
  it('to‘g‘ri sozlamani o‘qiydi va standart qiymatlarni qo‘yadi', () => {
    set({ ...GOOD, NODE_ENV: 'production', TRUSTED_PROXY_HOPS: undefined, COOKIE_SECURE: undefined, LOG_LEVEL: undefined });
    const e = env();
    expect(e.TRUSTED_PROXY_HOPS).toBe(0);
    expect(e.LOG_LEVEL).toBe('info');
    expect(e.COOKIE_SECURE).toBe(true); // production'da standart
  });

  it('COOKIE_SECURE=false — oddiy http ofis tarmog‘i uchun', () => {
    set({ ...GOOD, NODE_ENV: 'production', COOKIE_SECURE: 'false' });
    expect(env().COOKIE_SECURE).toBe(false);
  });

  it('qisqa AUTH_SECRET va yo‘q DATABASE_URL tushunarli xabar bilan rad etiladi', () => {
    set({ DATABASE_URL: undefined, AUTH_SECRET: 'qisqa' });
    expect(() => env()).toThrow(/AUTH_SECRET[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*AUTH_SECRET/);
  });

  it('TRUSTED_PROXY_HOPS son bo‘lishi kerak', () => {
    set({ ...GOOD, TRUSTED_PROXY_HOPS: 'ko‘p' });
    expect(() => env()).toThrow(/TRUSTED_PROXY_HOPS/);
  });
});

/**
 * Muhit o'zgaruvchilari (`.env`) — YAGONA kirish nuqtasi: kod `env()` dan o'qiydi, `process.env` dan emas.
 * Istisno: `shared/logger.ts` (LOG_LEVEL, server ishga tushmasdan oldin ham kerak) va Prisma (DATABASE_URL, DIRECT_URL — uni Prisma o'zi o'qiydi).
 * zod bilan tekshiriladi: xato bo'lsa server ishga tushmaydi va qaysi o'zgaruvchi noto'g'ri ekani aytiladi.
 */

import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** PostgreSQL manzili (ofis serverida — o'z Postgres). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL kiritilmagan'),
  /** Prisma migrate uchun to'g'ridan-to'g'ri ulanish (pooler'siz). Ilovaning o'zi ishlatmaydi. */
  DIRECT_URL: z.string().optional(),

  /** Sessiya imzosi kaliti: kamida 32 belgi. */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET kamida 32 belgi bo‘lsin'),

  /** Ilova oldidagi ishonchli reverse proxylar soni (IP bo'yicha cheklash uchun). 0 — proxy yo'q. */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  /**
   * Sessiya cookie'siga `Secure` bayrog'i. Standart: production'da true.
   * Ofis tarmog'ida HTTPS bo'lmasa (oddiy http) brauzer `Secure` cookie'ni saqlamaydi — shunda `false` qiling.
   */
  COOKIE_SECURE: bool.optional(),

  /** Jurnal (log) darajasi. */
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = Omit<z.infer<typeof schema>, 'COOKIE_SECURE'> & { COOKIE_SECURE: boolean };

let cached: Env | undefined;

/** O'zgaruvchilarni o'qiydi (birinchi chaqiruvda tekshiradi va eslab qoladi). */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(env)'}: ${i.message}`);
    throw new Error(`Muhit sozlamalari noto‘g‘ri (.env faylini tekshiring):\n${lines.join('\n')}`);
  }
  const v = parsed.data;
  cached = { ...v, COOKIE_SECURE: v.COOKIE_SECURE ?? v.NODE_ENV === 'production' };
  return cached;
}

/** Server ishga tushganda chaqiriladi (instrumentation.ts): noto'g'ri sozlama bilan ishlashni boshlamaydi. */
export function assertEnv(): void {
  env();
}

/** Faqat testlar uchun: keshni tozalash. */
export function resetEnvForTests(): void {
  cached = undefined;
}

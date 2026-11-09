/**
 * Parol qoidalari va urinishlarni cheklash — SOF mantiq (vaqt tashqaridan beriladi).
 */

export const MIN_PASSWORD = 8;

/** Boshlang'ich/keng tarqalgan parollar: majburiy almashtirishda shularga qaytib bo'lmaydi. */
const WEAK = new Set(['12345678', '123456789', 'password', 'parol123', 'qwerty123', 'otk2026!', 'otk2026', 'iPost2026'.toLowerCase()]);

export type PasswordCheck = { ok: true } | { ok: false; error: string };

export function validateNewPassword(next: string, ctx: { login: string; current?: string; confirm?: string }): PasswordCheck {
  if (next.length < MIN_PASSWORD) return { ok: false, error: `Yangi parol kamida ${MIN_PASSWORD} belgidan iborat bo‘lsin.` };
  if (next.length > 128) return { ok: false, error: 'Parol 128 belgidan oshmasin.' };
  if (ctx.confirm !== undefined && ctx.confirm !== next) return { ok: false, error: 'Yangi parol va takrori bir xil emas.' };
  if (ctx.current !== undefined && ctx.current === next) return { ok: false, error: 'Yangi parol eskisidan farq qilishi kerak.' };
  if (next.toLowerCase() === ctx.login.toLowerCase()) return { ok: false, error: 'Parol loginning o‘zi bo‘lmasin.' };
  if (WEAK.has(next.toLowerCase())) return { ok: false, error: 'Bu parol juda oddiy yoki boshlang‘ich parol. Boshqasini tanlang.' };
  if (!/[a-zA-Z]/.test(next) || !/\d/.test(next)) return { ok: false, error: 'Parolda kamida bitta harf va bitta raqam bo‘lsin.' };
  return { ok: true };
}

export interface Throttle {
  /** Qulflangan bo'lsa — necha soniyadan keyin qayta urinish mumkin; aks holda 0. */
  retryAfter(key: string, now: number): number;
  fail(key: string, now: number): void;
  reset(key: string): void;
}

/**
 * `max` ta muvaffaqiyatsiz urinishdan keyin `lockMs` ga qulflaydi. Urinishlar `windowMs` ichida sanaladi.
 * Xotirada (bitta jarayon uchun yetarli; qayta ishga tushirilsa tozalanadi).
 */
export function createThrottle(opts: { max: number; windowMs: number; lockMs: number }): Throttle {
  const state = new Map<string, { fails: number[]; lockedUntil: number }>();
  return {
    retryAfter(key, now) {
      const s = state.get(key);
      if (!s || s.lockedUntil <= now) return 0;
      return Math.ceil((s.lockedUntil - now) / 1000);
    },
    fail(key, now) {
      const s = state.get(key) ?? { fails: [], lockedUntil: 0 };
      s.fails = s.fails.filter((t) => now - t < opts.windowMs);
      s.fails.push(now);
      if (s.fails.length >= opts.max) {
        s.lockedUntil = now + opts.lockMs;
        s.fails = [];
      }
      state.set(key, s);
      // Xotira cheksiz o'smasin
      if (state.size > 10_000) for (const [k, v] of state) if (v.lockedUntil <= now && v.fails.length === 0) state.delete(k);
    },
    reset(key) {
      state.delete(key);
    },
  };
}

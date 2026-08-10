/**
 * Autentifikatsiya va ruxsatlar (server-only).
 *
 * Rollar:
 *   CEO        — hamma narsani ko'radi, KPI davrini tasdiqlaydi. Ma'lumot kiritmaydi.
 *   HEAD       — bo'lim boshlig'i: reyestr, audit, KPI faktlari, tizimli yechimlar.
 *   SPECIALIST — o'z murojaatlari va auditlari.
 *   VIEWER     — faqat o'qish (HR, moliya).
 */

import 'server-only';

import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { db } from './db';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Role, type SessionPayload } from './session';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Sahifa uchun sessiya talab qiladi, bo'lmasa login'ga yuboradi. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect('/ruxsat-yoq');
  return session;
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  session?: SessionPayload;
}

export async function authenticate(login: string, password: string): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { login: login.trim().toLowerCase() } });
  // Foydalanuvchi topilmasa ham parol tekshiriladi — javob vaqti bo'yicha login ochilmasligi uchun
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const valid = await verifyPassword(password, hash);

  if (!user || !valid) return { ok: false, error: 'Login yoki parol xato' };
  if (!user.active) return { ok: false, error: 'Hisob faolsizlantirilgan' };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    ok: true,
    session: { sub: user.id, key: user.key, name: user.shortName, role: user.role as Role },
  };
}

// ── Ruxsat qoidalari ─────────────────────────────────────────────────────────

/** Ma'lumot kiritish/o'zgartirish huquqi. CEO faqat kuzatadi va tasdiqlaydi. */
export function canWrite(role: Role): boolean {
  return role === 'HEAD' || role === 'SPECIALIST';
}

/** KPI faktini qo'lda o'zgartirish (override) — faqat bo'lim boshlig'i. */
export function canOverrideKpi(role: Role): boolean {
  return role === 'HEAD';
}

/** KPI davrini tasdiqlash — faqat CEO. */
export function canApprovePeriod(role: Role): boolean {
  return role === 'CEO';
}

/** Xodimlar, maosh va KPI pasportini boshqarish. */
export function canManageSettings(role: Role): boolean {
  return role === 'HEAD' || role === 'CEO';
}

/** Maoshni va bonus summasini ko'rish. */
export function canSeeSalary(role: Role): boolean {
  return role === 'CEO' || role === 'HEAD' || role === 'VIEWER';
}

export const ROLE_LABEL: Record<Role, string> = {
  CEO: 'Rahbariyat (CEO)',
  HEAD: "Bo'lim boshlig'i",
  SPECIALIST: 'Sifat nazorati mutaxassisi',
  VIEWER: 'Kuzatuvchi',
};

/**
 * Autentifikatsiya (server-only).
 *
 * Rollar (src/qc/policy.ts da ruxsat qoidalari):
 *   HEAD — Rahbar, INSPECTOR — Tekshiruvchi, VIEWER — Ko'ruvchi (faqat o'z bo'limi).
 */

import 'server-only';

import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { db } from './db';
import type { Actor } from '@/qc/policy';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Role, type SessionPayload } from './session';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type SessionActor = Actor & { name: string };

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

/**
 * Joriy foydalanuvchi — HAR SO'ROVDA bazadan o'qiladi: rol, bo'lim va faollik JWT ga emas,
 * bazaga ishonadi (rahbar rolni o'zgartirsa yoki hisobni o'chirsa, darhol kuchga kiradi).
 */
export async function getActor(): Promise<SessionActor | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true, deptId: true, active: true, shortName: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, role: user.role as Role, deptId: user.deptId, name: user.shortName };
}

export async function requireActor(): Promise<SessionActor> {
  const actor = await getActor();
  if (!actor) redirect('/login');
  return actor;
}

/** Sahifa uchun: rol ruxsat etilmagan bo'lsa /ruxsat-yoq ga yuboradi. */
export async function requireActorFor(...roles: Role[]): Promise<SessionActor> {
  const actor = await requireActor();
  if (!roles.includes(actor.role)) redirect('/ruxsat-yoq');
  return actor;
}

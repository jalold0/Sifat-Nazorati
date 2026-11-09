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
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Role, type SessionPayload } from './session';

import type { Actor } from '@/shared/actor';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Login topilmaganda solishtiriladigan HAQIQIY bcrypt hash (xuddi shu rounds bilan): javob vaqti mavjud
 * foydalanuvchinikidek bo'ladi va vaqt bo'yicha login borligini bilib bo'lmaydi.
 * (Noto'g'ri formatdagi soxta hash bilan bcrypt 0 ms da qaytadi — bu loginni oshkor qiladi.)
 */
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(`dummy-${crypto.randomUUID()}`, BCRYPT_ROUNDS);
  return dummyHash;
}
void getDummyHash(); // oldindan tayyorlanadi: birinchi noma'lum login ham sekinroq bo'lib qolmasin

/** Foydalanuvchining hamma sessiyalarini bekor qiladi (keyingi so'rovda getActor null qaytaradi). */
export async function revokeSessions(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

export type SessionActor = Actor & { name: string; mustChange: boolean };

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
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
  const hash = user?.passwordHash ?? (await getDummyHash());
  const valid = await verifyPassword(password, hash);

  if (!user || !valid) return { ok: false, error: 'Login yoki parol xato' };
  if (!user.active) return { ok: false, error: 'Hisob faolsizlantirilgan' };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    ok: true,
    session: {
      sub: user.id,
      key: user.key,
      name: user.shortName,
      role: user.role as Role,
      mc: user.mustChangePassword,
      sv: user.sessionVersion,
    },
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
    select: { id: true, role: true, deptId: true, active: true, shortName: true, mustChangePassword: true, sessionVersion: true },
  });
  // Versiya mos kelmasa — sessiya bekor qilingan (parol almashgan, chiqilgan yoki hisob o'chirilgan)
  if (!user || !user.active || user.sessionVersion !== session.sv) return null;
  return { id: user.id, role: user.role as Role, deptId: user.deptId, name: user.shortName, mustChange: user.mustChangePassword };
}

/**
 * Joriy foydalanuvchi. Parolni almashtirishi majburiy bo'lsa faqat /profil sahifasi (allowMustChange)
 * ochiladi; boshqa hamma sahifa va amal /profil ga yo'naltiradi.
 */
export async function requireActor(opts: { allowMustChange?: boolean } = {}): Promise<SessionActor> {
  const actor = await getActor();
  if (!actor) redirect('/login');
  if (actor.mustChange && !opts.allowMustChange) redirect('/profil');
  return actor;
}

/** Sahifa uchun: rol ruxsat etilmagan bo'lsa /ruxsat-yoq ga yuboradi. */
export async function requireActorFor(...roles: Role[]): Promise<SessionActor> {
  const actor = await requireActor();
  if (!roles.includes(actor.role)) redirect('/ruxsat-yoq');
  return actor;
}

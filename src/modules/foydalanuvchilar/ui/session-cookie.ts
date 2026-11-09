import 'server-only';

import { cookies } from 'next/headers';

import type { SessionClaims } from '../domain';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from '../infrastructure/session-token';

/** Joriy so'rovdagi sessiya da'volari (token imzosi tekshiriladi; baza tekshiruvi — `getActor` da). */
export async function getSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export async function createSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await signSession(claims);
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

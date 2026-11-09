/**
 * Sessiya — httpOnly cookie ichidagi imzolangan JWT.
 * Bu fayl Edge runtime'da ham ishlaydi (middleware), shuning uchun faqat `jose`.
 */

import { jwtVerify, SignJWT } from 'jose';

import { env } from '@/shared/env';

import type { SessionClaims } from '../domain';

export const SESSION_COOKIE = 'otk_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 soat — ish smenasi
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const { sub, key, name, role, mc, sv } = payload as unknown as SessionClaims;
    if (!sub || !role || typeof sv !== 'number') return null; // `sv` siz eski token — qayta kirish kerak
    return { sub, key, name, role, mc: mc === true, sv };
  } catch {
    return null;
  }
}

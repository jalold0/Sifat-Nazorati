/**
 * Sessiya — httpOnly cookie ichidagi imzolangan JWT.
 * Bu fayl Edge runtime'da ham ishlaydi (middleware), shuning uchun faqat `jose`.
 */

import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE = 'otk_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 soat — ish smenasi

export type Role = 'HEAD' | 'INSPECTOR' | 'VIEWER';

export interface SessionPayload {
  sub: string;
  key: string;
  name: string;
  role: Role;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET yo‘q yoki 32 belgidan qisqa — .env faylini tekshiring');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const { sub, key, name, role } = payload as unknown as SessionPayload;
    if (!sub || !role) return null;
    return { sub, key, name, role };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;

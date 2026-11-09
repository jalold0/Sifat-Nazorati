import 'server-only';

import { redirect } from 'next/navigation';

import type { QcRole } from '@/shared/actor';

import { resolveActor } from '..';
import type { SessionActor } from '../domain';

import { getSession } from './session-cookie';

/**
 * Joriy foydalanuvchi — HAR SO'ROVDA bazadan o'qiladi (rol, bo'lim, faollik, sessiya versiyasi).
 * Sessiya yo'q yoki bekor qilingan bo'lsa — null.
 */
export async function getActor(): Promise<SessionActor | null> {
  const claims = await getSession();
  return claims ? resolveActor(claims) : null;
}

/**
 * Sahifa/action uchun foydalanuvchi. Parolni almashtirishi majburiy bo'lsa faqat /profil (allowMustChange)
 * ochiladi; boshqa hamma sahifa va amal /profil ga yo'naltiradi.
 */
export async function requireActor(opts: { allowMustChange?: boolean } = {}): Promise<SessionActor> {
  const actor = await getActor();
  if (!actor) redirect('/login');
  if (actor.mustChange && !opts.allowMustChange) redirect('/profil');
  return actor;
}

/** Sahifa uchun: rol ruxsat etilmagan bo'lsa /ruxsat-yoq ga yuboradi. */
export async function requireActorFor(...roles: QcRole[]): Promise<SessionActor> {
  const actor = await requireActor();
  if (!roles.includes(actor.role)) redirect('/ruxsat-yoq');
  return actor;
}

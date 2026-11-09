import type { SessionActor, SessionClaims } from '../domain';

import type { UserDeps } from './ports';

/**
 * Sessiya da'volaridan amaldagi foydalanuvchini HAR SO'ROVDA bazadan o'qib aniqlaydi: rol, bo'lim va faollik
 * tokenga emas, bazaga ishonadi (rahbar rolni o'zgartirsa yoki hisobni o'chirsa — darhol kuchga kiradi).
 * Versiya mos kelmasa sessiya bekor qilingan (parol almashgan, chiqilgan yoki hisob o'chirilgan) — null.
 */
export async function resolveActor(deps: UserDeps, claims: SessionClaims): Promise<SessionActor | null> {
  const user = await deps.users().findById(claims.sub);
  if (!user || !user.active || user.sessionVersion !== claims.sv) return null;
  return { id: user.id, role: user.role, deptId: user.deptId, name: user.shortName, mustChange: user.mustChangePassword };
}

/** Foydalanuvchining hamma sessiyalarini bekor qiladi (chiqish). */
export async function revokeSessions(deps: UserDeps, userId: string): Promise<void> {
  await deps.users().update(userId, { revokeSessions: true });
}

/** Sessiya tokenini qayta berish uchun joriy da'volar (parol almashgandan keyin). */
export async function currentClaims(deps: UserDeps, userId: string): Promise<SessionClaims | null> {
  const user = await deps.users().findById(userId);
  if (!user) return null;
  return {
    sub: user.id,
    key: user.key,
    name: user.shortName,
    role: user.role,
    mc: user.mustChangePassword,
    sv: user.sessionVersion,
  };
}

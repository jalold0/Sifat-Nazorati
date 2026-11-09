import { bad, forbidden, ok, type Res } from '@/shared/result';

import { validateNewPassword } from '../domain';

import type { UserDeps } from './ports';

/** Foydalanuvchi o'z parolini almashtiradi. `userId` har doim sessiyadan keladi (so'rovdan emas). */
export async function changePassword(
  deps: UserDeps,
  userId: string,
  input: { current: unknown; next: unknown; confirm: unknown },
): Promise<Res<{ id: string }>> {
  const current = typeof input.current === 'string' ? input.current : '';
  const next = typeof input.next === 'string' ? input.next : '';
  const confirm = typeof input.confirm === 'string' ? input.confirm : '';
  if (!current) return bad('Joriy parolni kiriting.');

  const user = await deps.users().findById(userId);
  if (!user || !user.active) return forbidden('Hisob faol emas.');
  if (!(await deps.hasher.verify(current, user.passwordHash))) return bad('Joriy parol noto‘g‘ri.');
  const check = validateNewPassword(next, { login: user.login, current, confirm });
  if (!check.ok) return bad(check.error);

  // Parol almashsa boshqa qurilmalardagi hamma sessiyalar bekor bo'ladi
  await deps.users().update(userId, {
    passwordHash: await deps.hasher.hash(next),
    mustChangePassword: false,
    revokeSessions: true,
  });
  return ok({ id: userId });
}

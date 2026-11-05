/**
 * Foydalanuvchi o'z parolini almashtiradi. `userId` har doim sessiyadan keladi (so'rovdan emas).
 */

import bcrypt from 'bcryptjs';

import { db as defaultDb } from '@/lib/db';
import { validateNewPassword } from '@/qc/password';

import type { Ctx, Res } from './qc';

export async function changePassword(
  userId: string,
  input: { current: unknown; next: unknown; confirm: unknown },
  ctx?: Ctx,
): Promise<Res<{ id: string }>> {
  const client = ctx?.db ?? defaultDb;
  const current = typeof input.current === 'string' ? input.current : '';
  const next = typeof input.next === 'string' ? input.next : '';
  const confirm = typeof input.confirm === 'string' ? input.confirm : '';
  if (!current) return { ok: false, status: 400, error: 'Joriy parolni kiriting.' };

  const user = await client.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return { ok: false, status: 403, error: 'Hisob faol emas.' };
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return { ok: false, status: 400, error: 'Joriy parol noto‘g‘ri.' };
  }
  const check = validateNewPassword(next, { login: user.login, current, confirm });
  if (!check.ok) return { ok: false, status: 400, error: check.error };

  await client.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false },
  });
  return { ok: true, data: { id: userId } };
}

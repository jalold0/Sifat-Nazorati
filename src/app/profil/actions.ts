'use server';

import { redirect } from 'next/navigation';

import { createSessionCookie, requireActor } from '@/lib/auth';
import { db } from '@/lib/db';
import { changePassword } from '@/server/account';

import { homePath } from '@/modules/foydalanuvchilar/domain';

export interface PasswordState {
  error?: string;
}

export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const actor = await requireActor({ allowMustChange: true });
  const r = await changePassword(actor.id, {
    current: formData.get('current'),
    next: formData.get('next'),
    confirm: formData.get('confirm'),
  });
  if (!r.ok) return { error: r.error };

  // changePassword boshqa hamma sessiyalarni bekor qildi (versiya oshdi) — shu qurilmaga yangi sessiya beriladi
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  await createSessionCookie({
    sub: user.id,
    key: user.key,
    name: user.shortName,
    role: user.role,
    mc: false,
    sv: user.sessionVersion,
  });
  redirect(homePath(user.role));
}

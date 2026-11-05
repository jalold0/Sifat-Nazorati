'use server';

import { redirect } from 'next/navigation';

import { createSessionCookie, requireActor } from '@/lib/auth';
import { db } from '@/lib/db';
import { homePath } from '@/qc/policy';
import { changePassword } from '@/server/account';

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

  // Sessiya yangilanadi: «majburiy almashtirish» belgisi olib tashlanadi
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  await createSessionCookie({ sub: user.id, key: user.key, name: user.shortName, role: user.role, mc: false });
  redirect(homePath(user.role));
}

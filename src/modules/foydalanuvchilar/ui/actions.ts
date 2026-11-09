'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { changePassword, currentClaims, login, revokeSessions, saveUser, type UserInput } from '..';
import { clientIp, homePath, trustedHops } from '../domain';

import { getActor, requireActor } from './guards';
import { createSessionCookie, destroySessionCookie } from './session-cookie';

const loginSchema = z.object({
  login: z.string().min(2, 'Login kiritilmadi'),
  password: z.string().min(1, 'Parol kiritilmadi'),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

export interface PasswordState {
  error?: string;
}

export type SaveUserResult = { ok: true; id?: string } | { ok: false; error: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    login: formData.get('login'),
    password: formData.get('password'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot to‘liq emas' };
  }

  // IP faqat ishonchli proxy ortida olinadi (domain/client-ip.ts); aks holda faqat login bo'yicha cheklanadi
  const h = await headers();
  const ip = clientIp(h.get('x-forwarded-for'), trustedHops(process.env.TRUSTED_PROXY_HOPS));
  const outcome = await login({ login: parsed.data.login, password: parsed.data.password, ip, now: Date.now() });
  if (!outcome.ok) return { error: outcome.error };

  await createSessionCookie(outcome.claims);
  if (outcome.claims.mc) redirect('/profil');

  const next = parsed.data.next;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : homePath(outcome.claims.role);
  redirect(target);
}

/** Chiqish: cookie o'chiriladi va token ham bekor qilinadi (u nusxalangan bo'lsa ham boshqa ishlamaydi). */
export async function logoutAction(): Promise<void> {
  const actor = await getActor();
  if (actor) await revokeSessions(actor.id);
  await destroySessionCookie();
  redirect('/login');
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
  const claims = await currentClaims(actor.id);
  if (!claims) redirect('/login');
  await createSessionCookie({ ...claims, mc: false });
  redirect(homePath(claims.role));
}

export async function saveUserAction(input: UserInput): Promise<SaveUserResult> {
  const actor = await requireActor();
  const r = await saveUser(actor, input);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/sozlamalar/foydalanuvchilar');
  return { ok: true, id: r.data.id };
}

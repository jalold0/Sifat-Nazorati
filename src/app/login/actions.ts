'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { authenticate, createSessionCookie, destroySessionCookie } from '@/lib/auth';
import { homePath } from '@/qc/policy';

const schema = z.object({
  login: z.string().min(2, 'Login kiritilmadi'),
  password: z.string().min(1, 'Parol kiritilmadi'),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    login: formData.get('login'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot to‘liq emas' };
  }

  const result = await authenticate(parsed.data.login, parsed.data.password);
  if (!result.ok || !result.session) {
    return { error: result.error ?? 'Kirish amalga oshmadi' };
  }

  await createSessionCookie(result.session);

  const next = parsed.data.next;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : homePath(result.session.role);
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await destroySessionCookie();
  redirect('/login');
}

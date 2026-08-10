'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { authenticate, createSessionCookie, destroySessionCookie } from '@/lib/auth';
import { logActivity } from '@/server/shared';

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
  await logActivity({
    actorId: result.session.sub,
    action: 'auth.login',
    entity: 'User',
    entityId: result.session.sub,
    summary: `${result.session.name} tizimga kirdi`,
  });

  const target = parsed.data.next && parsed.data.next.startsWith('/') ? parsed.data.next : '/dashboard';
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await destroySessionCookie();
  redirect('/login');
}

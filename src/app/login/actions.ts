'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { authenticate, createSessionCookie, destroySessionCookie } from '@/lib/auth';
import { loginThrottle } from '@/lib/throttle';
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

  // Parolni terib topishdan himoya: login va manzil bo'yicha urinishlar cheklanadi
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'local').split(',')[0]!.trim();
  const loginKey = `login:${parsed.data.login.trim().toLowerCase()}`;
  const ipKey = `ip:${ip}`;
  const now = Date.now();
  const wait = Math.max(loginThrottle.login.retryAfter(loginKey, now), loginThrottle.ip.retryAfter(ipKey, now));
  if (wait > 0) {
    return { error: `Juda ko‘p noto‘g‘ri urinish. ${Math.ceil(wait / 60)} daqiqadan keyin qayta urinib ko‘ring.` };
  }

  const result = await authenticate(parsed.data.login, parsed.data.password);
  if (!result.ok || !result.session) {
    loginThrottle.login.fail(loginKey, now);
    loginThrottle.ip.fail(ipKey, now);
    return { error: result.error ?? 'Kirish amalga oshmadi' };
  }
  loginThrottle.login.reset(loginKey);

  await createSessionCookie(result.session);
  if (result.session.mc) redirect('/profil');

  const next = parsed.data.next;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : homePath(result.session.role);
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await destroySessionCookie();
  redirect('/login');
}

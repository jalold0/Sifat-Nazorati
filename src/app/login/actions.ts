'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { authenticate, createSessionCookie, destroySessionCookie, getActor, revokeSessions } from '@/lib/auth';
import { loginThrottle } from '@/lib/throttle';
import { clientIp, trustedHops } from '@/qc/client-ip';
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
  // IP faqat ishonchli proxy ortida olinadi (src/qc/client-ip.ts); aks holda faqat login bo'yicha cheklanadi
  const h = await headers();
  const ip = clientIp(h.get('x-forwarded-for'), trustedHops(process.env.TRUSTED_PROXY_HOPS));
  const loginKey = `login:${parsed.data.login.trim().toLowerCase()}`;
  const ipKey = ip ? `ip:${ip}` : null;
  const now = Date.now();
  const wait = Math.max(
    loginThrottle.login.retryAfter(loginKey, now),
    ipKey ? loginThrottle.ip.retryAfter(ipKey, now) : 0,
  );
  if (wait > 0) {
    return { error: `Juda ko‘p noto‘g‘ri urinish. ${Math.ceil(wait / 60)} daqiqadan keyin qayta urinib ko‘ring.` };
  }

  const result = await authenticate(parsed.data.login, parsed.data.password);
  if (!result.ok || !result.session) {
    loginThrottle.login.fail(loginKey, now);
    if (ipKey) loginThrottle.ip.fail(ipKey, now);
    return { error: result.error ?? 'Kirish amalga oshmadi' };
  }
  loginThrottle.login.reset(loginKey);

  await createSessionCookie(result.session);
  if (result.session.mc) redirect('/profil');

  const next = parsed.data.next;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : homePath(result.session.role);
  redirect(target);
}

/** Chiqish: cookie o'chiriladi va token ham bekor qilinadi (u nusxalangan bo'lsa ham boshqa ishlamaydi). */
export async function logoutAction(): Promise<void> {
  const actor = await getActor();
  if (actor) await revokeSessions(actor.id);
  await destroySessionCookie();
  redirect('/login');
}

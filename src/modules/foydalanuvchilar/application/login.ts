import type { SessionClaims } from '../domain';

import type { UserDeps } from './ports';

export type LoginOutcome = { ok: true; claims: SessionClaims } | { ok: false; error: string };

/**
 * Kirish. Parolni terib topishdan himoya: login va (ishonchli proxy ortida) manzil bo'yicha noto'g'ri
 * urinishlar cheklanadi. Login topilmasa ham parol solishtiriladi — javob vaqti bir xil.
 */
export async function login(
  deps: UserDeps,
  input: { login: string; password: string; ip: string | null; now: number },
): Promise<LoginOutcome> {
  const { guard } = deps;
  const loginKey = `login:${input.login.trim().toLowerCase()}`;
  const ipKey = input.ip ? `ip:${input.ip}` : null;
  const wait = Math.max(guard.login.retryAfter(loginKey, input.now), ipKey ? guard.ip.retryAfter(ipKey, input.now) : 0);
  if (wait > 0) {
    return { ok: false, error: `Juda ko‘p noto‘g‘ri urinish. ${Math.ceil(wait / 60)} daqiqadan keyin qayta urinib ko‘ring.` };
  }

  const users = deps.users();
  const user = await users.findByLogin(input.login.trim().toLowerCase());
  const hash = user?.passwordHash ?? (await deps.hasher.dummyHash());
  const valid = await deps.hasher.verify(input.password, hash);

  if (!user || !valid) {
    guard.login.fail(loginKey, input.now);
    if (ipKey) guard.ip.fail(ipKey, input.now);
    return { ok: false, error: 'Login yoki parol xato' };
  }
  if (!user.active) {
    guard.login.fail(loginKey, input.now);
    if (ipKey) guard.ip.fail(ipKey, input.now);
    return { ok: false, error: 'Hisob faolsizlantirilgan' };
  }

  guard.login.reset(loginKey);
  await users.recordLogin(user.id, new Date(input.now));
  return {
    ok: true,
    claims: {
      sub: user.id,
      key: user.key,
      name: user.shortName,
      role: user.role,
      mc: user.mustChangePassword,
      sv: user.sessionVersion,
    },
  };
}

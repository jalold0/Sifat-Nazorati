import { QC_ROLE_LABEL, roleNeedsDept, type Actor, type QcRole } from '@/shared/actor';
import { bad, forbidden, notFound, ok, type Res } from '@/shared/result';

import { canManageUsers } from '../domain';

import type { UserDeps, UserDto, UserInput } from './ports';

const ROLES: QcRole[] = ['HEAD', 'INSPECTOR', 'SUPERVISOR', 'VIEWER'];
const NO_ACCESS = 'Foydalanuvchilarni faqat rahbar boshqara oladi.';

export async function listUsers(deps: UserDeps, actor: Actor): Promise<Res<UserDto[]>> {
  if (!canManageUsers(actor)) return forbidden(NO_ACCESS);
  return ok(await deps.users().list());
}

/** Foydalanuvchi yaratish/o'zgartirish (faqat rahbar). O'zgarish jurnalga shu tranzaksiyada yoziladi. */
export async function saveUser(deps: UserDeps, actor: Actor, input: UserInput): Promise<Res<{ id: string }>> {
  if (!canManageUsers(actor)) return forbidden(NO_ACCESS);

  const fullName = (input.fullName ?? '').trim();
  if (!fullName) return bad('Ism-familiyani yozing.');
  if (!ROLES.includes(input.role)) return bad('Rol noto‘g‘ri.');
  const deptId = roleNeedsDept(input.role) ? (input.deptId ?? null) : null;
  if (roleNeedsDept(input.role)) {
    if (!deptId) return bad(`${QC_ROLE_LABEL[input.role]} uchun bo‘limni tanlang.`);
    if (!(await deps.users().departmentExists(deptId))) return bad('Bo‘lim topilmadi.');
  }
  const password = input.password?.trim() ?? '';
  if (password && password.length < 8) return bad('Parol kamida 8 belgidan iborat bo‘lsin.');

  if (input.id) return updateUser(deps, actor, input, { fullName, deptId, password });

  const login = (input.login ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,32}$/.test(login)) return bad('Login 2–32 belgi: lotin harflari, raqam, nuqta, chiziq.');
  if (!password) return bad('Yangi foydalanuvchi uchun parol kiriting (kamida 8 belgi).');
  if (await deps.users().findByLogin(login)) return bad('Bunday login band. Boshqa login tanlang.');

  const passwordHash = await deps.hasher.hash(password);
  const id = await deps.uow.run(async (tx) => {
    const created = await deps.users(tx).create({
      key: login,
      login,
      fullName,
      shortName: fullName.length > 24 ? `${fullName.slice(0, 23)}…` : fullName,
      role: input.role,
      position: QC_ROLE_LABEL[input.role],
      deptId,
      active: input.active,
      passwordHash,
      mustChangePassword: true, // yangi hisob: birinchi kirishda parolni almashtirish majburiy
    });
    await deps.journal(tx).write({
      actorId: actor.id,
      action: 'user.save',
      entity: 'User',
      entityId: created,
      summary: `Yangi foydalanuvchi: ${login} (${input.role})`,
    });
    return created;
  });
  return ok({ id });
}

async function updateUser(
  deps: UserDeps,
  actor: Actor,
  input: UserInput,
  v: { fullName: string; deptId: string | null; password: string },
): Promise<Res<{ id: string }>> {
  const user = await deps.users().findById(input.id as string);
  if (!user) return notFound('Foydalanuvchi topilmadi.');
  if (user.id === actor.id && (input.role !== 'HEAD' || !input.active)) {
    return bad('O‘zingizning rolingizni o‘zgartira yoki hisobingizni o‘chira olmaysiz.');
  }

  const lines: string[] = [];
  if (user.role !== input.role) lines.push(`rol: ${user.role} → ${input.role}`);
  if ((user.deptId ?? null) !== v.deptId) lines.push('bo‘lim o‘zgardi');
  if (user.active !== input.active) lines.push(input.active ? 'faollashtirildi' : 'o‘chirildi (kira olmaydi)');
  if (v.password) lines.push('parol qayta o‘rnatildi (keyingi kirishda almashtirish majburiy)');
  const passwordHash = v.password ? await deps.hasher.hash(v.password) : null;

  await deps.uow.run(async (tx) => {
    await deps.users(tx).update(user.id, {
      fullName: v.fullName,
      role: input.role,
      deptId: v.deptId,
      active: input.active,
      ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
      // Parol qayta o'rnatilsa yoki hisob o'chirilsa — uning hamma ochiq sessiyalari darhol bekor bo'ladi
      ...(passwordHash || !input.active ? { revokeSessions: true } : {}),
    });
    if (lines.length > 0) {
      await deps.journal(tx).write({
        actorId: actor.id,
        action: 'user.save',
        entity: 'User',
        entityId: user.id,
        summary: `${user.login}: ${lines.join('; ')}`,
      });
    }
  });
  return ok({ id: user.id });
}

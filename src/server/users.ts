/**
 * Foydalanuvchilar (faqat rahbar): rol va ko'ruvchi uchun «Bo'lim» maydoni.
 * Kirish, parol shifrlash va sessiya mantig'i o'zgarmaydi — faqat `deptId` qo'shilgan.
 */

import bcrypt from 'bcryptjs';

import { db as defaultDb } from '@/lib/db';
import { QC_ROLE_LABEL, roleNeedsDept, type Actor, type QcRole } from '@/qc/policy';

import { logChange } from './log';
import type { Ctx, Res } from './qc';

export interface UserDto {
  id: string;
  login: string;
  fullName: string;
  role: QcRole;
  deptId: string | null;
  active: boolean;
}

const forbidden = (): Res<never> => ({ ok: false, status: 403, error: 'Foydalanuvchilarni faqat rahbar boshqara oladi.' });
const bad = (error: string): Res<never> => ({ ok: false, status: 400, error });

const ROLES: QcRole[] = ['HEAD', 'INSPECTOR', 'SUPERVISOR', 'VIEWER'];

export async function listUsers(actor: Actor, ctx?: Ctx): Promise<Res<UserDto[]>> {
  if (actor.role !== 'HEAD') return forbidden();
  const rows = await (ctx?.db ?? defaultDb).user.findMany({
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    select: { id: true, login: true, fullName: true, role: true, deptId: true, active: true },
  });
  return { ok: true, data: rows.map((u) => ({ ...u, role: u.role as QcRole })) };
}

export interface UserInput {
  id?: string;
  login?: string;
  fullName: string;
  role: QcRole;
  /** Ko'ruvchi uchun majburiy; boshqa rollar uchun e'tiborga olinmaydi. */
  deptId?: string | null;
  active: boolean;
  /** Yangi foydalanuvchi uchun majburiy; mavjudda — faqat to'ldirilsa almashtiriladi. */
  password?: string;
}

export async function saveUser(actor: Actor, input: UserInput, ctx?: Ctx): Promise<Res<{ id: string }>> {
  if (actor.role !== 'HEAD') return forbidden();
  const client = ctx?.db ?? defaultDb;

  const fullName = (input.fullName ?? '').trim();
  if (!fullName) return bad('Ism-familiyani yozing.');
  if (!ROLES.includes(input.role)) return bad('Rol noto‘g‘ri.');
  const deptId = roleNeedsDept(input.role) ? (input.deptId ?? null) : null;
  if (roleNeedsDept(input.role)) {
    if (!deptId) return bad(`${QC_ROLE_LABEL[input.role]} uchun bo‘limni tanlang.`);
    const dept = await client.qcDepartment.findUnique({ where: { id: deptId }, select: { id: true } });
    if (!dept) return bad('Bo‘lim topilmadi.');
  }
  const password = input.password?.trim() ?? '';
  if (password && password.length < 8) return bad('Parol kamida 8 belgidan iborat bo‘lsin.');

  if (input.id) {
    const user = await client.user.findUnique({ where: { id: input.id } });
    if (!user) return { ok: false, status: 404, error: 'Foydalanuvchi topilmadi.' };
    if (user.id === actor.id && (input.role !== 'HEAD' || !input.active)) {
      return bad('O‘zingizning rolingizni o‘zgartira yoki hisobingizni o‘chira olmaysiz.');
    }
    const lines: string[] = [];
    if (user.role !== input.role) lines.push(`rol: ${user.role} → ${input.role}`);
    if ((user.deptId ?? null) !== deptId) lines.push('bo‘lim o‘zgardi');
    if (user.active !== input.active) lines.push(input.active ? 'faollashtirildi' : 'o‘chirildi (kira olmaydi)');
    if (password) lines.push('parol qayta o‘rnatildi (keyingi kirishda almashtirish majburiy)');
    const hash = password ? await bcrypt.hash(password, 12) : null;
    await client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          fullName,
          shortName: user.shortName,
          role: input.role,
          deptId,
          active: input.active,
          ...(hash ? { passwordHash: hash, mustChangePassword: true } : {}),
          // Parol qayta o'rnatilsa yoki hisob o'chirilsa — uning hamma ochiq sessiyalari darhol bekor bo'ladi
          ...(hash || !input.active ? { sessionVersion: { increment: 1 } } : {}),
        },
      });
      if (lines.length > 0) {
        await logChange(tx, { actorId: actor.id, action: 'user.save', entity: 'User', entityId: user.id, summary: `${user.login}: ${lines.join('; ')}` });
      }
    });
    return { ok: true, data: { id: user.id } };
  }

  const login = (input.login ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,32}$/.test(login)) return bad('Login 2–32 belgi: lotin harflari, raqam, nuqta, chiziq.');
  if (!password) return bad('Yangi foydalanuvchi uchun parol kiriting (kamida 8 belgi).');
  if (await client.user.findUnique({ where: { login }, select: { id: true } })) {
    return bad('Bunday login band. Boshqa login tanlang.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await client.user.create({
    data: {
      key: login,
      login,
      fullName,
      shortName: fullName.length > 24 ? `${fullName.slice(0, 23)}…` : fullName,
      role: input.role,
      position: QC_ROLE_LABEL[input.role],
      deptId,
      active: input.active,
      passwordHash,
      mustChangePassword: true,
    },
    select: { id: true },
  });
  await logChange(client, { actorId: actor.id, action: 'user.save', entity: 'User', entityId: created.id, summary: `Yangi foydalanuvchi: ${login} (${input.role})` });
  return { ok: true, data: { id: created.id } };
}

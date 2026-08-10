'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canManageSettings, hashPassword, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { refreshResults } from '@/server/kpi';
import { logActivity } from '@/server/shared';

export interface SettingsState {
  error?: string;
  ok?: string;
}

const userSchema = z.object({
  id: z.string().min(1),
  salary: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : Number(v.replace(/[\s,]/g, ''))))
    .nullable()
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), 'Maosh xato'),
  position: z.string().trim().min(2, 'Lavozimni kiriting'),
  active: z.coerce.boolean(),
});

/** Xodim ma'lumotlari — maosh bonus hisobiga to'g'ridan-to'g'ri kiradi. */
export async function updateUserAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireSession();
  if (!canManageSettings(session.role)) return { error: 'Bu amal huquqingizda emas' };

  const parsed = userSchema.safeParse({
    id: formData.get('id'),
    salary: formData.get('salary') ?? '',
    position: formData.get('position'),
    active: formData.get('active') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot xato' };

  const updated = await db.user.update({
    where: { id: parsed.data.id },
    data: { salary: parsed.data.salary, position: parsed.data.position, active: parsed.data.active },
    select: { shortName: true },
  });

  await logActivity({
    actorId: session.sub,
    action: 'user.update',
    entity: 'User',
    entityId: parsed.data.id,
    summary: `${updated.shortName} — maosh ${parsed.data.salary ?? '—'}, ${parsed.data.active ? 'faol' : 'faolsiz'}`,
  });

  // Bonus summasi maoshga bog'liq — snapshot'lar yangilanishi kerak
  const periods = await db.kpiPeriod.findMany({
    where: { status: { not: 'APPROVED' } },
    select: { period: true },
  });
  for (const p of periods) await refreshResults(p.period);

  revalidatePath('/sozlamalar');
  revalidatePath('/kpi');
  return { ok: `${updated.shortName} ma’lumoti saqlandi` };
}

const passwordSchema = z
  .object({
    id: z.string().min(1),
    password: z.string().min(8, 'Parol kamida 8 belgi bo‘lishi kerak'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Parollar mos kelmadi', path: ['confirm'] });

export async function setPasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireSession();
  const id = String(formData.get('id') ?? '');

  // O'z parolini har kim o'zgartira oladi; boshqasining parolini faqat boshqaruvchi rol
  if (id !== session.sub && !canManageSettings(session.role)) {
    return { error: 'Boshqa xodimning parolini o‘zgartirish huquqingiz yo‘q' };
  }

  const parsed = passwordSchema.safeParse({
    id,
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot xato' };

  await db.user.update({
    where: { id: parsed.data.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  await logActivity({
    actorId: session.sub,
    action: 'user.password',
    entity: 'User',
    entityId: parsed.data.id,
    summary: id === session.sub ? 'O‘z parolini o‘zgartirdi' : 'Xodim parolini almashtirdi',
  });

  revalidatePath('/sozlamalar');
  return { ok: 'Parol o‘zgartirildi' };
}

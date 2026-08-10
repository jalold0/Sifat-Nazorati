'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canWrite, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { isPeriod } from '@/lib/period';
import { recalculatePeriod } from '@/server/kpi';
import { logActivity } from '@/server/shared';

export interface SolutionState {
  error?: string;
  ok?: string;
}

const schema = z.object({
  period: z.string().refine(isPeriod, 'Davr formati xato'),
  title: z.string().trim().min(4, 'Muammo nomini kiriting'),
  problem: z.string().trim().min(5, 'Muammo tavsifini kiriting'),
  repeatCount: z.coerce.number().int().min(0).max(100000),
  rootCause: z.string().trim().min(5, 'Sabab (root cause) kiritilishi shart'),
  solution: z.string().trim().min(5, 'Taklif etilgan yechimni yozing'),
  responsibleDept: z.string().trim().min(2, "Mas'ul bo'limni kiriting"),
  dueDate: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : new Date(`${v}T00:00:00.000Z`)))
    .nullable(),
});

export async function createSolutionAction(_prev: SolutionState, formData: FormData): Promise<SolutionState> {
  const session = await requireSession();
  if (!canWrite(session.role)) return { error: 'Kiritish huquqingiz yo‘q' };

  const parsed = schema.safeParse({
    period: formData.get('period'),
    title: formData.get('title'),
    problem: formData.get('problem'),
    repeatCount: formData.get('repeatCount') || 0,
    rootCause: formData.get('rootCause'),
    solution: formData.get('solution'),
    responsibleDept: formData.get('responsibleDept'),
    dueDate: formData.get('dueDate') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot to‘liq emas' };

  const created = await db.rootCauseAction.create({
    data: { ...parsed.data, createdById: session.sub },
    select: { id: true, title: true },
  });

  await logActivity({
    actorId: session.sub,
    action: 'solution.create',
    entity: 'RootCauseAction',
    entityId: String(created.id),
    summary: `Tizimli yechim: ${created.title}`,
  });

  revalidatePath('/yechimlar');
  return { ok: 'Tizimli yechim qo‘shildi' };
}

const statusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED']),
  effect: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});

export async function updateSolutionStatusAction(
  _prev: SolutionState,
  formData: FormData,
): Promise<SolutionState> {
  const session = await requireSession();
  if (!canWrite(session.role)) return { error: 'Kiritish huquqingiz yo‘q' };

  const parsed = statusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
    effect: formData.get('effect') ?? '',
  });
  if (!parsed.success) return { error: 'Ma’lumot xato' };

  // "Natija tasdiqlandi" holati KPI'ga kiradi — shuning uchun natija yozilishi shart
  if (parsed.data.status === 'VERIFIED' && !parsed.data.effect) {
    return { error: 'Tasdiqlash uchun erishilgan natijani yozing — bu KPI ko‘rsatkichiga kiradi' };
  }

  const updated = await db.rootCauseAction.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      effect: parsed.data.effect,
      verifiedAt: parsed.data.status === 'VERIFIED' ? new Date() : null,
    },
    select: { title: true, period: true },
  });

  await logActivity({
    actorId: session.sub,
    action: 'solution.status',
    entity: 'RootCauseAction',
    entityId: String(parsed.data.id),
    summary: `${updated.title} — holat: ${parsed.data.status}`,
  });
  await recalculatePeriod(updated.period, session.sub);

  revalidatePath('/yechimlar');
  revalidatePath('/kpi');
  return { ok: 'Holat yangilandi' };
}

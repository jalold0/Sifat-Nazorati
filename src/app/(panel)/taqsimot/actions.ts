'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canManageSettings, requireSession } from '@/lib/auth';
import { reassignTask } from '@/server/assignments';

export interface ReassignState {
  error?: string;
  ok?: string;
}

const schema = z.object({
  taskNo: z.coerce.number().int().positive(),
  newOwnerId: z.string().min(1, "Yangi mas'ulni tanlang"),
  newBackupId: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
  reason: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
  effectiveFrom: z.string().min(10, 'Kuchga kirish sanasini kiriting'),
});

/**
 * Vazifani boshqa xodimga biriktirish.
 * Sabab majburiy — taqsimot o'zgarishi nizoga sabab bo'ladi, shuning uchun
 * "nima uchun" degan savolga javob har doim yozib qoldiriladi.
 */
export async function reassignAction(_prev: ReassignState, formData: FormData): Promise<ReassignState> {
  const session = await requireSession();
  if (!canManageSettings(session.role)) {
    return { error: 'Taqsimotni o‘zgartirish bo‘lim boshlig‘i va rahbariyat huquqida' };
  }

  const parsed = schema.safeParse({
    taskNo: formData.get('taskNo'),
    newOwnerId: formData.get('newOwnerId'),
    newBackupId: formData.get('newBackupId') ?? '',
    reason: formData.get('reason') ?? '',
    effectiveFrom: formData.get('effectiveFrom'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot xato' };

  if (!parsed.data.reason) {
    return { error: 'Sababni yozing — taqsimot o‘zgarishi hujjatlashtirilishi kerak' };
  }

  const effectiveFrom = new Date(parsed.data.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) return { error: 'Sana formati xato' };

  const result = await reassignTask({
    taskNo: parsed.data.taskNo,
    newOwnerId: parsed.data.newOwnerId,
    newBackupId: parsed.data.newBackupId,
    reason: parsed.data.reason,
    effectiveFrom,
    actorId: session.sub,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath('/taqsimot');
  revalidatePath(`/taqsimot/${parsed.data.taskNo}`);
  revalidatePath('/reyestr/yangi');
  revalidatePath('/izlar');

  return { ok: 'Taqsimot o‘zgartirildi. Oldingi davr eski mas’ul hisobida qoldi.' };
}

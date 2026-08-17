'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canManageSettings, requireSession } from '@/lib/auth';
import { createTask, reassignTask, setTaskActive, updateTask } from '@/server/assignments';

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

// ── Katalogni boshqarish ────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Vazifa nomini kiriting'),
  source: z.string().trim().min(1, 'Manba / kanalni kiriting'),
  zoneCode: z.string().trim().min(1, 'Zonani tanlang'),
  frequency: z.string().trim().min(1, 'Davriylikni tanlang'),
  slaHours: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : Number(v)))
    .nullable()
    .refine((v) => v === null || Number.isFinite(v), 'SLA son bo‘lishi kerak'),
  priority: z.string().trim().min(1),
  kind: z.string().trim().min(1),
});

/** Yangi vazifa qo'shish. */
export async function createTaskAction(_prev: ReassignState, formData: FormData): Promise<ReassignState> {
  const session = await requireSession();
  if (!canManageSettings(session.role)) {
    return { error: 'Vazifa qo‘shish bo‘lim boshlig‘i va rahbariyat huquqida' };
  }

  const parsed = taskSchema.safeParse({
    title: formData.get('title'),
    source: formData.get('source'),
    zoneCode: formData.get('zoneCode'),
    frequency: formData.get('frequency'),
    slaHours: formData.get('slaHours') ?? '',
    priority: formData.get('priority'),
    kind: formData.get('kind'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot xato' };

  const ownerId = String(formData.get('ownerId') ?? '');
  const backupRaw = String(formData.get('backupId') ?? '').trim();

  const result = await createTask({
    data: parsed.data,
    ownerId,
    backupId: backupRaw.length === 0 ? null : backupRaw,
    actorId: session.sub,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath('/taqsimot');
  revalidatePath('/reyestr/yangi');
  revalidatePath('/izlar');

  return { ok: `Vazifa №${result.taskNo} qo‘shildi. Endi reyestrda shu vazifani tanlash mumkin.` };
}

/** Vazifa maydonlarini tahrirlash (mas'ul bundan mustasno). */
export async function updateTaskAction(_prev: ReassignState, formData: FormData): Promise<ReassignState> {
  const session = await requireSession();
  if (!canManageSettings(session.role)) {
    return { error: 'Vazifani tahrirlash bo‘lim boshlig‘i va rahbariyat huquqida' };
  }

  const taskNo = Number(formData.get('taskNo'));
  if (!Number.isInteger(taskNo)) return { error: 'Vazifa raqami xato' };

  const parsed = taskSchema.safeParse({
    title: formData.get('title'),
    source: formData.get('source'),
    zoneCode: formData.get('zoneCode'),
    frequency: formData.get('frequency'),
    slaHours: formData.get('slaHours') ?? '',
    priority: formData.get('priority'),
    kind: formData.get('kind'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot xato' };

  const result = await updateTask({ taskNo, data: parsed.data, actorId: session.sub });
  if (!result.ok) return { error: result.error };

  revalidatePath('/taqsimot');
  revalidatePath(`/taqsimot/${taskNo}`);
  revalidatePath('/reyestr/yangi');

  return { ok: result.summary };
}

/** Arxivlash yoki arxivdan qaytarish. */
export async function toggleTaskActiveAction(taskNo: number, active: boolean): Promise<void> {
  const session = await requireSession();
  if (!canManageSettings(session.role)) return;

  await setTaskActive({ taskNo, active, actorId: session.sub });

  revalidatePath('/taqsimot');
  revalidatePath(`/taqsimot/${taskNo}`);
  revalidatePath('/reyestr/yangi');
}

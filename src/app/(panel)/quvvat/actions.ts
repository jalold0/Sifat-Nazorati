'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canManageSettings, requireSession } from '@/lib/auth';
import { isPeriod } from '@/lib/period';
import { measureNorms, saveScenario } from '@/server/capacity';
import { logActivity } from '@/server/shared';

export interface CapacityState {
  error?: string;
  ok?: string;
}

const schema = z.object({
  id: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? undefined : Number(v)))
    .optional(),
  name: z.string().trim().min(2, 'Nom kiriting'),
  period: z.string().refine(isPeriod, 'Davr formati xato'),
  monthlyVolume: z.coerce.number().int().min(1, 'Oylik oqim kiritilmadi'),
  workingDays: z.coerce.number().int().min(1).max(31),
  hoursPerDay: z.coerce.number().min(1).max(24),
  specialists: z.coerce.number().min(0.5).max(100),
  utilisation: z.coerce.number().min(0.1).max(1),
  proactiveShare: z.coerce.number().min(0).max(0.9),
  note: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});

export async function saveScenarioAction(_prev: CapacityState, formData: FormData): Promise<CapacityState> {
  const session = await requireSession();
  if (!canManageSettings(session.role)) return { error: 'Bu amal bo‘lim boshlig‘i huquqida' };

  const parsed = schema.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name'),
    period: formData.get('period'),
    monthlyVolume: formData.get('monthlyVolume'),
    workingDays: formData.get('workingDays'),
    hoursPerDay: formData.get('hoursPerDay'),
    specialists: formData.get('specialists'),
    utilisation: formData.get('utilisation'),
    proactiveShare: formData.get('proactiveShare'),
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot xato' };

  const zones: Array<{ zoneCode: string; flowShare: number; minutesPerCase: number }> = [];
  for (const code of ['A', 'B', 'C', 'D']) {
    const share = formData.get(`flow-${code}`);
    const minutes = formData.get(`min-${code}`);
    if (typeof share !== 'string' || share.trim().length === 0) continue;
    const flowShare = Number(share) / 100; // foizda kiritiladi
    const minutesPerCase = Number(minutes ?? 0);
    if (!Number.isFinite(flowShare) || flowShare <= 0) continue;
    zones.push({ zoneCode: code, flowShare, minutesPerCase });
  }

  if (zones.length === 0) return { error: 'Kamida bitta zona bo‘yicha oqim ulushi kiritilishi kerak' };

  const total = zones.reduce((s, z) => s + z.flowShare, 0);
  if (Math.abs(total - 1) > 0.02) {
    return { error: `Zona ulushlari yig‘indisi 100% bo‘lishi kerak — hozir ${Math.round(total * 100)}%` };
  }

  try {
    const saved = await saveScenario({ ...parsed.data, zones });
    await logActivity({
      actorId: session.sub,
      action: 'capacity.save',
      entity: 'CapacityScenario',
      entityId: String(saved.id),
      summary: `Quvvat sxemasi "${parsed.data.name}" (${parsed.data.period}) saqlandi`,
    });
    revalidatePath('/quvvat');
    return { ok: 'Sxema saqlandi va qayta hisoblandi' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Saqlashda xatolik' };
  }
}

/** Reyestrdagi real vaqt bo'yicha normani o'lchash. */
export async function measureAction(period: string) {
  await requireSession();
  return measureNorms(period);
}

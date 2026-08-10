'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canApprovePeriod, canOverrideKpi, requireSession } from '@/lib/auth';
import { isPeriod } from '@/lib/period';
import { recalculatePeriod, setManualFact, setPeriodStatus, updatePeriodSettings } from '@/server/kpi';

export interface KpiState {
  error?: string;
  ok?: string;
}

function revalidate(period: string) {
  revalidatePath('/kpi');
  revalidatePath('/dashboard');
  revalidatePath('/hisobot');
  void period;
}

/** Faktlarni reyestrdan qayta hisoblash. */
export async function recalcAction(_prev: KpiState, formData: FormData): Promise<KpiState> {
  const session = await requireSession();
  if (!canOverrideKpi(session.role)) return { error: 'Faqat bo‘lim boshlig‘i qayta hisoblay oladi' };

  const period = String(formData.get('period') ?? '');
  if (!isPeriod(period)) return { error: 'Davr formati xato' };

  try {
    const count = await recalculatePeriod(period, session.sub);
    revalidate(period);
    return { ok: `${count} ko‘rsatkich reyestrdan qayta hisoblandi` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Qayta hisoblashda xatolik' };
  }
}

const factSchema = z.object({
  period: z.string().refine(isPeriod, 'Davr formati xato'),
  indicatorId: z.coerce.number().int().positive(),
  value: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : Number(v.replace(',', '.'))))
    .nullable()
    .refine((v) => v === null || Number.isFinite(v), 'Qiymat son bo‘lishi kerak'),
  comment: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});

/**
 * Qo'lda fakt kiritish yoki avtomatik qiymatni tuzatish.
 * Tuzatish izohsiz qabul qilinmaydi — CEO har bir aralashuvni ko'rishi kerak.
 */
export async function setFactAction(_prev: KpiState, formData: FormData): Promise<KpiState> {
  const session = await requireSession();
  if (!canOverrideKpi(session.role)) return { error: 'Faqat bo‘lim boshlig‘i fakt kiritadi' };

  const parsed = factSchema.safeParse({
    period: formData.get('period'),
    indicatorId: formData.get('indicatorId'),
    value: formData.get('value') ?? '',
    comment: formData.get('comment') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot xato' };

  const isOverride = formData.get('isAuto') === '1' && parsed.data.value !== null;
  if (isOverride && !parsed.data.comment) {
    return { error: 'Avtomatik qiymatni tuzatish uchun izoh yozilishi shart' };
  }

  try {
    await setManualFact({
      period: parsed.data.period,
      indicatorId: parsed.data.indicatorId,
      displayValue: parsed.data.value,
      comment: parsed.data.comment,
      actorId: session.sub,
    });
    revalidate(parsed.data.period);
    return { ok: 'Saqlandi' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Saqlashda xatolik' };
  }
}

const statusSchema = z.object({
  period: z.string().refine(isPeriod),
  status: z.enum(['DRAFT', 'TRIAL', 'SUBMITTED', 'APPROVED', 'REJECTED']),
  comment: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});

export async function statusAction(_prev: KpiState, formData: FormData): Promise<KpiState> {
  const session = await requireSession();
  const parsed = statusSchema.safeParse({
    period: formData.get('period'),
    status: formData.get('status'),
    comment: formData.get('comment') ?? '',
  });
  if (!parsed.success) return { error: 'Ma’lumot xato' };

  const { status, period, comment } = parsed.data;

  // Tasdiqlash va qaytarish — faqat CEO; qolgan holatlar — bo'lim boshlig'i
  if ((status === 'APPROVED' || status === 'REJECTED') && !canApprovePeriod(session.role)) {
    return { error: 'Davrni tasdiqlash yoki qaytarish faqat rahbariyat huquqida' };
  }
  if (status !== 'APPROVED' && status !== 'REJECTED' && !canOverrideKpi(session.role)) {
    return { error: 'Bu amal bo‘lim boshlig‘i huquqida' };
  }
  if (status === 'REJECTED' && !comment) {
    return { error: 'Qaytarish sababini yozing — bo‘lim nimani tuzatishini bilishi kerak' };
  }

  try {
    await setPeriodStatus({ period, status, actorId: session.sub, comment });
    revalidate(period);
    const labels: Record<typeof status, string> = {
      DRAFT: 'davr qayta ochildi',
      TRIAL: 'sinov rejimi yoqildi',
      SUBMITTED: 'rahbariyatga yuborildi',
      APPROVED: 'tasdiqlandi',
      REJECTED: 'qaytarildi',
    };
    return { ok: `Davr ${labels[status]}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Amalda xatolik' };
  }
}

const settingsSchema = z.object({
  period: z.string().refine(isPeriod),
  bonusShare: z.coerce.number().min(0).max(2),
  threshold: z.coerce.number().min(0).max(120),
  cap: z.coerce.number().min(1).max(2),
  workingDays: z.coerce.number().int().min(1).max(31),
  note: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});

export async function periodSettingsAction(_prev: KpiState, formData: FormData): Promise<KpiState> {
  const session = await requireSession();
  if (!canOverrideKpi(session.role)) return { error: 'Faqat bo‘lim boshlig‘i sozlaydi' };

  const parsed = settingsSchema.safeParse({
    period: formData.get('period'),
    bonusShare: formData.get('bonusShare'),
    threshold: formData.get('threshold'),
    cap: formData.get('cap'),
    workingDays: formData.get('workingDays'),
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot xato' };

  try {
    await updatePeriodSettings({ ...parsed.data, actorId: session.sub });
    revalidate(parsed.data.period);
    return { ok: 'Sozlamalar saqlandi va ballar qayta hisoblandi' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Saqlashda xatolik' };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canWrite, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { logActivity } from '@/server/shared';

export interface ReviewState {
  error?: string;
  ok?: string;
}

const schema = z.object({
  id: z.coerce.number().int().positive(),
  result: z.enum(['PENDING', 'RESOLVED', 'UNRESOLVED', 'NOT_RELEVANT']),
  resolvedWhere: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
  note: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});

/**
 * "Javob izi yo'q" ishlarni tekshirish natijasini belgilash.
 * Bu ishlar bajarilmagan degani emas — ko'pchiligi telefon yoki ichki tizimda hal qilingan,
 * lekin buni isbotlab bo'lmaydi. Shu ro'yxat aynan shuni yopadi.
 */
export async function setReviewResultAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const session = await requireSession();
  if (!canWrite(session.role)) return { error: 'Kiritish huquqingiz yo‘q' };

  const parsed = schema.safeParse({
    id: formData.get('id'),
    result: formData.get('result'),
    resolvedWhere: formData.get('resolvedWhere') ?? '',
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return { error: 'Ma’lumot xato' };

  if (parsed.data.result === 'RESOLVED' && !parsed.data.resolvedWhere) {
    return { error: 'Qayerda hal qilinganini ko‘rsating — isbot shu bilan qoladi' };
  }

  await db.reviewItem.update({
    where: { id: parsed.data.id },
    data: {
      result: parsed.data.result,
      resolvedWhere: parsed.data.resolvedWhere,
      note: parsed.data.note,
      assignedToId: session.sub,
    },
  });

  await logActivity({
    actorId: session.sub,
    action: 'review.result',
    entity: 'ReviewItem',
    entityId: String(parsed.data.id),
    summary: `Tekshirish natijasi: ${parsed.data.result}${parsed.data.resolvedWhere ? ` — ${parsed.data.resolvedWhere}` : ''}`,
  });

  revalidatePath('/tekshiruv');
  return { ok: 'Saqlandi' };
}

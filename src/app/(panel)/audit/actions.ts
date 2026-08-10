'use server';

import type { ChecklistKind } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canWrite, requireSession } from '@/lib/auth';
import { periodOf } from '@/lib/period';
import { createAudit } from '@/server/audits';
import { recalculatePeriod } from '@/server/kpi';
import { logActivity } from '@/server/shared';

export interface AuditState {
  error?: string;
  ok?: string;
}

const schema = z.object({
  kind: z.enum(['WAREHOUSE', 'BRANCH', 'CALL']),
  objectName: z.string().trim().min(2, "Ob'ekt nomini kiriting"),
  objectCode: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
  externalRef: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
  auditedAt: z.string().min(10, 'Tekshiruv sanasini kiriting'),
  notes: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
});

export async function createAuditAction(_prev: AuditState, formData: FormData): Promise<AuditState> {
  const session = await requireSession();
  if (!canWrite(session.role)) return { error: 'Audit kiritish huquqingiz yo‘q' };

  const parsed = schema.safeParse({
    kind: formData.get('kind'),
    objectName: formData.get('objectName'),
    objectCode: formData.get('objectCode') ?? '',
    externalRef: formData.get('externalRef') ?? '',
    auditedAt: formData.get('auditedAt'),
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot to‘liq emas' };

  // Har bir band uchun baho va dalil: score-<itemId> / note-<itemId>
  const answers: Array<{ itemId: number; score: number; note: string | null }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('score-')) continue;
    const itemId = Number(key.slice('score-'.length));
    if (!Number.isFinite(itemId)) continue;
    const raw = String(value);
    if (raw.length === 0) continue;
    const note = formData.get(`note-${itemId}`);
    answers.push({
      itemId,
      score: Number(raw),
      note: typeof note === 'string' && note.trim().length > 0 ? note.trim() : null,
    });
  }

  if (answers.length === 0) return { error: 'Hech bir band baholanmadi' };

  try {
    const auditedAt = new Date(`${parsed.data.auditedAt}T00:00:00.000Z`);
    const created = await createAudit({
      kind: parsed.data.kind as ChecklistKind,
      objectName: parsed.data.objectName,
      objectCode: parsed.data.objectCode,
      externalRef: parsed.data.externalRef,
      auditedAt,
      auditorId: session.sub,
      notes: parsed.data.notes,
      answers,
    });

    await logActivity({
      actorId: session.sub,
      action: 'audit.create',
      entity: 'Audit',
      entityId: String(created.id),
      summary: `${parsed.data.objectName} auditi — ${Math.round(Number(created.percent) * 100)}% (${created.verdict})`,
    });
    await recalculatePeriod(periodOf(auditedAt), session.sub);

    revalidatePath('/audit');
    revalidatePath('/dashboard');
    revalidatePath('/kpi');
    return { ok: `Audit saqlandi — ${Math.round(Number(created.percent) * 100)}%: ${created.verdict}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Saqlashda xatolik' };
  }
}

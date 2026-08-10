'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canWrite, requireSession } from '@/lib/auth';
import { dayKey, periodOf } from '@/lib/period';
import { recalculatePeriod } from '@/server/kpi';
import { closeTicket, createTicket, updateTicket } from '@/server/registry';
import { logActivity } from '@/server/shared';

export interface FormState {
  error?: string;
  ok?: string;
}

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable();

const optionalDateTime = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : new Date(v)))
  .nullable()
  .refine((v) => v === null || !Number.isNaN(v.getTime()), 'Vaqt formati xato');

const ticketSchema = z.object({
  date: z.string().min(10, 'Sana kiritilmadi'),
  channel: z.string().trim().min(2, 'Kanal kiritilmadi'),
  zoneCode: z.enum(['A', 'B', 'C', 'D']),
  taskDefId: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : Number(v)))
    .nullable(),
  category: z.string().trim().min(2, 'Vazifa turi kiritilmadi'),
  objectName: optionalText,
  description: z.string().trim().min(5, 'Muammo tavsifi juda qisqa'),
  externalRef: optionalText,
  ownerId: z.string().min(1, "Mas'ul tanlanmadi"),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  kind: z.enum(['PROACTIVE', 'REACTIVE']),
  slaHours: z.coerce.number().int().min(1, 'SLA kiritilmadi').max(720),
  receivedAt: z.string().min(10, 'Qabul vaqti kiritilmadi'),
  firstResponseAt: optionalDateTime,
  escalatedAt: optionalDateTime,
  closedAt: optionalDateTime,
  spentHours: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : Number(v.replace(',', '.'))))
    .nullable()
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), 'Sarflangan vaqt xato'),
  isRepeat: z.coerce.boolean(),
  rootCause: optionalText,
  actionTaken: optionalText,
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ESCALATED', 'CLOSED', 'CANCELLED']),
});

function parse(formData: FormData) {
  return ticketSchema.safeParse({
    date: formData.get('date'),
    channel: formData.get('channel'),
    zoneCode: formData.get('zoneCode'),
    taskDefId: formData.get('taskDefId') ?? '',
    category: formData.get('category'),
    objectName: formData.get('objectName') ?? '',
    description: formData.get('description'),
    externalRef: formData.get('externalRef') ?? '',
    ownerId: formData.get('ownerId'),
    priority: formData.get('priority'),
    kind: formData.get('kind'),
    slaHours: formData.get('slaHours'),
    receivedAt: formData.get('receivedAt'),
    firstResponseAt: formData.get('firstResponseAt') ?? '',
    escalatedAt: formData.get('escalatedAt') ?? '',
    closedAt: formData.get('closedAt') ?? '',
    spentHours: formData.get('spentHours') ?? '',
    isRepeat: formData.get('isRepeat') === 'on',
    rootCause: formData.get('rootCause') ?? '',
    actionTaken: formData.get('actionTaken') ?? '',
    status: formData.get('status'),
  });
}

export async function createTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!canWrite(session.role)) return { error: 'Ma’lumot kiritish huquqingiz yo‘q' };

  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot to‘liq emas' };
  const d = parsed.data;

  // Yopilgan deb belgilangan bo'lsa, yopilish vaqti va chora majburiy
  if (d.status === 'CLOSED' && !d.closedAt) {
    return { error: 'Yopilgan murojaat uchun yopilish vaqtini kiriting' };
  }
  if (d.status === 'CLOSED' && !d.rootCause) {
    return { error: 'Yopishda sabab (root cause) yozilishi shart — takrorlanishni to‘xtatish uchun' };
  }

  try {
    const created = await createTicket({
      date: new Date(`${d.date}T00:00:00.000Z`),
      channel: d.channel,
      zoneCode: d.zoneCode,
      taskDefId: d.taskDefId,
      category: d.category,
      objectName: d.objectName,
      description: d.description,
      externalRef: d.externalRef,
      ownerId: d.ownerId,
      priority: d.priority,
      kind: d.kind,
      slaHours: d.slaHours,
      receivedAt: new Date(d.receivedAt),
      firstResponseAt: d.firstResponseAt,
      escalatedAt: d.escalatedAt,
      closedAt: d.closedAt,
      spentHours: d.spentHours,
      isRepeat: d.isRepeat,
      rootCause: d.rootCause,
      actionTaken: d.actionTaken,
      status: d.status,
      createdById: session.sub,
    });

    await logActivity({
      actorId: session.sub,
      action: 'ticket.create',
      entity: 'Ticket',
      entityId: created.id,
      summary: `${created.ref} — ${d.channel} / ${d.category}`,
    });
    await recalculatePeriod(periodOf(new Date(`${d.date}T00:00:00.000Z`)), session.sub);

    revalidatePath('/reyestr');
    revalidatePath('/dashboard');
    return { ok: `${created.ref} qayd etildi` };
  } catch (error) {
    console.error(error);
    return { error: 'Saqlashda xatolik yuz berdi' };
  }
}

const closeSchema = z.object({
  id: z.string().min(1),
  closedAt: z.string().min(10, 'Yopilish vaqti kiritilmadi'),
  spentHours: z.coerce.number().min(0, 'Sarflangan vaqt xato').max(500),
  rootCause: z.string().trim().min(5, 'Sabab (root cause) yozilishi shart'),
  actionTaken: z.string().trim().min(3, "Ko'rilgan chora yozilishi shart"),
  isRepeat: z.coerce.boolean(),
});

export async function closeTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!canWrite(session.role)) return { error: 'Ma’lumot kiritish huquqingiz yo‘q' };

  const parsed = closeSchema.safeParse({
    id: formData.get('id'),
    closedAt: formData.get('closedAt'),
    spentHours: formData.get('spentHours'),
    rootCause: formData.get('rootCause'),
    actionTaken: formData.get('actionTaken'),
    isRepeat: formData.get('isRepeat') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ma’lumot to‘liq emas' };

  const closedAt = new Date(parsed.data.closedAt);
  const updated = await closeTicket({ ...parsed.data, closedAt });

  await logActivity({
    actorId: session.sub,
    action: 'ticket.close',
    entity: 'Ticket',
    entityId: updated.id,
    summary: `${updated.ref} yopildi — ${parsed.data.spentHours} soat`,
  });
  await recalculatePeriod(periodOf(closedAt), session.sub);

  revalidatePath('/reyestr');
  revalidatePath(`/reyestr/${updated.id}`);
  revalidatePath('/dashboard');
  return { ok: `${updated.ref} yopildi` };
}

/** Tezkor amal: birinchi javob vaqtini yoki eskalatsiyani hozirgi vaqt bilan belgilash. */
export async function markTicketAction(id: string, field: 'firstResponseAt' | 'escalatedAt'): Promise<void> {
  const session = await requireSession();
  if (!canWrite(session.role)) return;

  const now = new Date();
  const updated = await updateTicket({
    id,
    [field]: now,
    ...(field === 'escalatedAt' ? { status: 'ESCALATED' as const } : {}),
  });

  await logActivity({
    actorId: session.sub,
    action: field === 'escalatedAt' ? 'ticket.escalate' : 'ticket.respond',
    entity: 'Ticket',
    entityId: id,
    summary: `${updated.ref} — ${field === 'escalatedAt' ? 'eskalatsiya qilindi' : 'birinchi javob belgilandi'} (${dayKey(now)})`,
  });

  revalidatePath(`/reyestr/${id}`);
  revalidatePath('/reyestr');
}

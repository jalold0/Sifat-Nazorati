import type { Prisma } from '@prisma/client';

import { db } from '@/lib/db';

/** Prisma Decimal → number. Null bo'lsa null qoladi. */
export function num(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

/** Decimal → number, null bo'lsa 0. */
export function num0(value: Prisma.Decimal | number | null | undefined): number {
  return num(value) ?? 0;
}

/** O'zgarish izini yozish — CEO nazorati uchun. Xatolik asosiy amalni to'xtatmaydi. */
export async function logActivity(input: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
}): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
      },
    });
  } catch (error) {
    console.error('activity log yozilmadi', error);
  }
}

export const PRIORITY_LABEL = {
  CRITICAL: 'Kritik',
  HIGH: 'Yuqori',
  MEDIUM: "O'rta",
  LOW: 'Past',
} as const;

export const STATUS_LABEL = {
  OPEN: 'Ochiq',
  IN_PROGRESS: 'Ishlanmoqda',
  ESCALATED: 'Eskalatsiya',
  CLOSED: 'Yopilgan',
  CANCELLED: 'Bekor qilindi',
} as const;

export const KIND_LABEL = {
  PROACTIVE: 'Proaktiv',
  REACTIVE: 'Reaktiv',
} as const;

export const PERIOD_STATUS_LABEL = {
  DRAFT: "To'ldirilmoqda",
  TRIAL: 'Sinov rejimi',
  SUBMITTED: 'CEO tasdiqlashida',
  APPROVED: 'Tasdiqlangan',
  REJECTED: 'Qaytarilgan',
} as const;

export const CHECKLIST_LABEL = {
  WAREHOUSE: 'Ombor va RS auditi',
  BRANCH: 'Filial va hamkor punkt auditi',
  CALL: "Qo'ng'iroq va chat sifati",
} as const;

export const ACTION_STATUS_LABEL = {
  PLANNED: 'Rejalashtirilgan',
  IN_PROGRESS: 'Bajarilmoqda',
  DONE: 'Bajarildi',
  VERIFIED: 'Natija tasdiqlandi',
  CANCELLED: 'Bekor qilindi',
} as const;

export const REVIEW_RESULT_LABEL = {
  PENDING: 'Tekshirilmagan',
  RESOLVED: 'Hal qilingan',
  UNRESOLVED: 'Hal qilinmagan',
  NOT_RELEVANT: 'Ishga aloqasiz',
} as const;

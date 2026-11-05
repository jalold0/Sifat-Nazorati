/**
 * O'zgarishlar jurnali: faqat qo'shiladi. Asosiy amal tranzaksiyasi ichida chaqiriladi —
 * jurnalga yozilmasa, o'zgarishning o'zi ham saqlanmaydi (iz bo'lmagan o'zgarish bo'lmasin).
 */

import type { Prisma, PrismaClient } from '@prisma/client';

import { db as defaultDb } from '@/lib/db';
import type { Actor } from '@/qc/policy';

import type { Ctx, Res } from './qc';

type Client = PrismaClient | Prisma.TransactionClient;

export interface LogInput {
  actorId: string;
  action: 'audit.update' | 'audit.delete' | 'dept.save' | 'dept.move' | 'task.update' | 'user.save' | 'report.note';
  entity: 'QcAudit' | 'QcDepartment' | 'QcTask' | 'User' | 'QcReport';
  entityId?: string | null;
  summary: string;
  details?: Prisma.InputJsonValue;
}

export async function logChange(client: Client, input: LogInput): Promise<void> {
  await client.qcLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      summary: input.summary.slice(0, 2000),
      details: input.details,
    },
  });
}

export const LOG_PAGE = 50;

export interface LogRow {
  id: string;
  at: string;
  actor: string;
  action: string;
  summary: string;
  hasDetails: boolean;
}

/** Jurnalni faqat rahbar ko'radi; yangisi birinchi. */
export async function listLog(
  actor: Actor,
  q: { offset?: number; action?: string },
  ctx?: Ctx,
): Promise<Res<{ rows: LogRow[]; total: number }>> {
  if (actor.role !== 'HEAD') return { ok: false, status: 403, error: 'Jurnalni faqat rahbar ko‘ra oladi.' };
  const client = ctx?.db ?? defaultDb;
  const where: Prisma.QcLogWhereInput = q.action ? { action: q.action } : {};
  const [rows, total] = await Promise.all([
    client.qcLog.findMany({
      where,
      orderBy: { at: 'desc' },
      take: LOG_PAGE,
      skip: Math.max(q.offset ?? 0, 0),
      include: { actor: { select: { shortName: true } } },
    }),
    client.qcLog.count({ where }),
  ]);
  return {
    ok: true,
    data: {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        at: r.at.toISOString(),
        actor: r.actor.shortName,
        action: r.action,
        summary: r.summary,
        hasDetails: r.details !== null,
      })),
    },
  };
}

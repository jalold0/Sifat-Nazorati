/**
 * Jurnalga yozish adapteri (Prisma). Hamma modul `JournalWriter` port'i orqali shuni ishlatadi;
 * `tx` berilsa yozuv asosiy amal bilan bir tranzaksiyada bo'ladi.
 */

import type { Prisma, PrismaClient } from '@prisma/client';

import type { JournalEntry, JournalWriter } from '../journal';
import type { Tx } from '../unit-of-work';

import { dbOf, type Db } from './prisma';

/** Yozuvni berilgan tutqich (mijoz yoki tranzaksiya) bilan yozadi. */
export async function writeJournal(db: Db, entry: JournalEntry): Promise<void> {
  await db.qcLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 2000),
      details: entry.details as Prisma.InputJsonValue | undefined,
    },
  });
}

export function prismaJournal(client: PrismaClient, tx?: Tx): JournalWriter {
  return { write: (entry) => writeJournal(dbOf(client, tx), entry) };
}

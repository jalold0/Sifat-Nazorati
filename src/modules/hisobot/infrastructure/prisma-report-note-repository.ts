import type { PrismaClient } from '@prisma/client';

import { dbOf } from '@/shared/infrastructure/prisma';
import type { Tx } from '@/shared/unit-of-work';

import type { ReportNoteRepository } from '../application/ports';

export function prismaReportNoteRepository(client: PrismaClient, tx?: Tx): ReportNoteRepository {
  const db = dbOf(client, tx);
  return {
    async find(week) {
      const row = await db.qcReport.findUnique({ where: { week }, include: { by: { select: { shortName: true } } } });
      return row ? { note: row.note, byName: row.by.shortName, updatedAt: row.updatedAt } : null;
    },

    async save(week, note, byId) {
      await db.qcReport.upsert({
        where: { week },
        create: { week, note, byId },
        update: { note, byId },
      });
    },
  };
}

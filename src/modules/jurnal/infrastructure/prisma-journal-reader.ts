import type { Prisma, PrismaClient } from '@prisma/client';

import type { JournalReader } from '../application/ports';

export function prismaJournalReader(client: PrismaClient): JournalReader {
  return {
    async list({ action, offset, limit }) {
      const where: Prisma.QcLogWhereInput = action ? { action } : {};
      const [rows, total] = await Promise.all([
        client.qcLog.findMany({
          where,
          orderBy: { at: 'desc' },
          take: limit,
          skip: offset,
          include: { actor: { select: { shortName: true } } },
        }),
        client.qcLog.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          at: r.at.toISOString(),
          actor: r.actor.shortName,
          action: r.action,
          summary: r.summary,
          hasDetails: r.details !== null,
        })),
      };
    },
  };
}

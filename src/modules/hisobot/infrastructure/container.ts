import { getSummaryData } from '@/modules/auditlar';
import { type Ctx, nowOf } from '@/shared/context';
import { prismaJournal } from '@/shared/infrastructure/journal';
import { clientOf, prismaUnitOfWork } from '@/shared/infrastructure/prisma';

import type { ReportDeps } from '../application/ports';

import { prismaReportNoteRepository } from './prisma-report-note-repository';

export function reportDeps(ctx?: Ctx): ReportDeps {
  const client = clientOf(ctx);
  return {
    uow: prismaUnitOfWork(client),
    notes: (tx) => prismaReportNoteRepository(client, tx),
    journal: (tx) => prismaJournal(client, tx),
    // Xom yozuvlar — `auditlar` modulining ochiq API'si orqali
    summary: { load: (actor, q) => getSummaryData(actor, q, ctx) },
    now: () => nowOf(ctx),
  };
}

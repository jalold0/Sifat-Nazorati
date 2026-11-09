/**
 * Modul `jurnal` — o'zgarishlar jurnalini o'qish (kim, qachon, nima).
 * Yozish port'i `shared/journal.ts`, uning Prisma adapteri `shared/infrastructure/journal.ts`.
 */

import type { Actor } from '@/shared/actor';
import type { Ctx } from '@/shared/context';
import { clientOf } from '@/shared/infrastructure/prisma';

import { listLog as listLogUseCase, LOG_PAGE } from './application/list-log';
import type { LogRow } from './application/ports';
import { prismaJournalReader } from './infrastructure/prisma-journal-reader';

export { LOG_PAGE };
export type { LogRow };

export const listLog = (actor: Actor, q: { offset?: number; action?: string }, ctx?: Ctx) =>
  listLogUseCase(prismaJournalReader(clientOf(ctx)), actor, q);

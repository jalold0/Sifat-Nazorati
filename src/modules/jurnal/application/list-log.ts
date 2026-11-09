import { canViewJournal } from '@/modules/foydalanuvchilar/domain';
import { forbidden, ok, type Res } from '@/shared/result';
import type { Actor } from '@/shared/actor';

import type { JournalReader, LogRow } from './ports';

export const LOG_PAGE = 50;

/** Jurnalni faqat rahbar ko'radi; yangisi birinchi. */
export async function listLog(
  reader: JournalReader,
  actor: Actor,
  q: { offset?: number; action?: string },
): Promise<Res<{ rows: LogRow[]; total: number }>> {
  if (!canViewJournal(actor)) return forbidden('Jurnalni faqat rahbar ko‘ra oladi.');
  return ok(await reader.list({ action: q.action, offset: Math.max(q.offset ?? 0, 0), limit: LOG_PAGE }));
}

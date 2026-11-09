import type { SummaryData } from '@/modules/auditlar/domain';
import type { Actor } from '@/shared/actor';
import type { JournalWriter } from '@/shared/journal';
import type { Res } from '@/shared/result';
import type { Tx, UnitOfWork } from '@/shared/unit-of-work';

/** Haftalik hisobotga rahbar izohi. */
export interface ReportNote {
  note: string;
  byName: string;
  updatedAt: Date;
}

export interface ReportNoteRepository {
  find(week: string): Promise<ReportNote | null>;
  /** Mavjud izohni almashtiradi yoki yangisini yaratadi. */
  save(week: string, note: string, byId: string): Promise<void>;
}

/** Hisob uchun xom yozuvlar — `auditlar` modulining ochiq API'si orqali. */
export interface SummarySource {
  load(actor: Actor, q: { dept?: string; from: string; to: string }): Promise<Res<SummaryData>>;
}

export interface ReportDeps {
  uow: UnitOfWork;
  notes(tx?: Tx): ReportNoteRepository;
  journal(tx?: Tx): JournalWriter;
  summary: SummarySource;
  now(): Date;
}

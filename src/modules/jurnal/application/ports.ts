export interface LogRow {
  id: string;
  /** ISO vaqt (UTC) */
  at: string;
  actor: string;
  action: string;
  summary: string;
  hasDetails: boolean;
}

/** Jurnalni o'qish port'i (yozish — `shared/journal.ts` dagi `JournalWriter`). */
export interface JournalReader {
  list(q: { action?: string; offset: number; limit: number }): Promise<{ rows: LogRow[]; total: number }>;
}

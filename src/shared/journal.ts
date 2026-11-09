/**
 * O'zgarishlar jurnali port'i. Hamma modul jurnalga shu interfeys orqali yozadi; amalga oshirish `jurnal`
 * modulida. Yozuv asosiy amal bilan bir tranzaksiyada bo'lishi uchun repozitoriy `tx` bilan olinadi.
 */

export type JournalAction =
  | 'audit.update'
  | 'audit.delete'
  | 'dept.save'
  | 'dept.move'
  | 'task.update'
  | 'user.save'
  | 'report.note';

export type JournalEntity = 'QcAudit' | 'QcDepartment' | 'QcTask' | 'User' | 'QcReport';

export interface JournalEntry {
  actorId: string;
  action: JournalAction;
  entity: JournalEntity;
  entityId?: string | null;
  summary: string;
  /** Kerak bo'lsa tiklash uchun ma'lumot (masalan, o'chirilgan tekshiruv nusxasi). Oddiy JSON bo'lishi kerak. */
  details?: unknown;
}

export interface JournalWriter {
  write(entry: JournalEntry): Promise<void>;
}

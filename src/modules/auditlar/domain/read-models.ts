/**
 * Tekshiruv va topshiriq o'qish modellari: brauzerga uzatiladigan oddiy obyektlar va so'rov shakllari.
 */

import type { DeptDto } from '@/modules/bolimlar/domain';
import type { ListKind } from '@/shared/lists';

import type { AuditRec, TaskRec } from './types';

export const PAGE_SIZE = 50;

export interface AuditDto extends AuditRec {
  by: string;
  byName: string;
  subject: string;
  notes: Record<string, { text: string; ref: string }>;
  createdAt: string;
  updatedAt: string;
  noCount: number;
  scorePct: number | null;
  list: ListKind;
  /** Muloqot bahosida baholangan operator ismi */
  staffName: string | null;
}

export interface TaskDto extends TaskRec {
  checkNote: string | null;
  checkedByName: string | null;
}

export interface SummaryData {
  today: string;
  departments: DeptDto[];
  audits: AuditRec[];
  tasks: TaskRec[];
}

export interface AuditQuery {
  dept?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  /** Faqat shu cheklist */
  list?: ListKind;
}

export interface TaskQuery {
  dept?: string;
  status?: 'open' | 'closed';
  dueBefore?: string;
}

export type TaskTab = 'overdue' | 'open' | 'closed';

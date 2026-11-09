/**
 * Hisobot o'qish modellari: bo'lim kesimidagi baho, xulosa va haftalik hisobot.
 */

import type { StaffBreakdownRow } from '@/modules/auditlar/domain';
import type { DeptDto } from '@/modules/bolimlar/domain';

import type { DeptEvaluation } from './evaluate';
import type { InteractionRow } from './interaction';
import type { PeriodKey, Range } from './period';
import type { Summary, TopNo } from './summary';

export interface DeptReportData {
  dept: DeptDto;
  evaluation: DeptEvaluation;
  summary: Summary;
  topNo: TopNo[];
  /** Davr bo'yicha hodimlar kesimi (hodimli nuqtalar bo'lmasa — bo'sh). */
  staff: StaffBreakdownRow[];
  /** Davr bo'yicha muloqot bahosi — operatorlar kesimi (eng zaifi tepada). */
  interactions: InteractionRow[];
  overdueTaskIds: string[];
  /** asOf kuniga ochiq topshiriqlar soni. */
  openCount: number;
}

export interface Report {
  today: string;
  range: Range;
  period: PeriodKey;
  items: DeptReportData[];
}

export interface WeeklyReport {
  week: string;
  to: string;
  report: Omit<Report, 'period'> & { period?: never };
  note: string;
  noteBy: string | null;
  noteAt: string | null;
  counts: { green: number; yellow: number; red: number; gray: number };
  canEdit: boolean;
}

/** Rahbar izohining eng uzun hajmi (belgi). */
export const NOTE_MAX = 4000;

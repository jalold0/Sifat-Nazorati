/**
 * Modul `hisobot` — panel/«Bo'limim» hisoboti va haftalik hisobot (rahbar izohi bilan).
 * Ochiq API: use-case'lar (shu fayl), sof domain (`./domain`), UI (`./ui`).
 */

import type { Actor } from '@/shared/actor';
import type { Ctx } from '@/shared/context';

import { loadReport as loadReportUseCase, parsePeriod } from './application/report';
import { getWeeklyReport as getWeeklyReportUseCase, saveReportNote as saveReportNoteUseCase } from './application/weekly';
import type { PeriodKey } from './domain';
import { reportDeps } from './infrastructure/container';

export { parsePeriod };
export type { DeptReportData, Report, WeeklyReport } from './domain';

export const loadReport = (actor: Actor, period: PeriodKey, deptId?: string, ctx?: Ctx) =>
  loadReportUseCase(reportDeps(ctx), actor, period, deptId);

export const getWeeklyReport = (actor: Actor, week: unknown, ctx?: Ctx) => getWeeklyReportUseCase(reportDeps(ctx), actor, week);

export const saveReportNote = (actor: Actor, week: unknown, note: unknown, ctx?: Ctx) =>
  saveReportNoteUseCase(reportDeps(ctx), actor, week, note);

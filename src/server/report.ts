/**
 * Panel va «Bo'limim» uchun hisobot: xom yozuvlarni (server/qc.ts) calc.ts bilan birlashtiradi.
 * Hisob mantig'i bu yerda YO'Q — faqat chaqiriladi.
 */

import {
  buildSummary,
  evaluateDept,
  periodRange,
  STATUS_RANK,
  todayTashkent,
  topNoCheckpoints,
  type DeptEvaluation,
  type PeriodKey,
  type Range,
  type Summary,
  type TopNo,
} from '@/qc/calc';
import type { Actor } from '@/qc/policy';

import { getSummaryData, type Ctx, type DeptDto, type Res } from './qc';

export interface DeptReportData {
  dept: DeptDto;
  evaluation: DeptEvaluation;
  summary: Summary;
  topNo: TopNo[];
  overdueTaskIds: string[];
}

export interface Report {
  today: string;
  range: Range;
  period: PeriodKey;
  items: DeptReportData[];
}

export function parsePeriod(value: string | undefined): PeriodKey {
  return value === 'today' || value === '30' ? value : '7';
}

export async function loadReport(
  actor: Actor,
  period: PeriodKey,
  deptId?: string,
  ctx?: Ctx,
): Promise<Res<Report>> {
  const now = todayTashkent(ctx?.now);
  const range = periodRange(period, now);

  const res = await getSummaryData(actor, { dept: deptId, from: range.prevFrom, to: range.to }, ctx);
  if (!res.ok) return res;
  const { departments, audits, tasks } = res.data;

  const items = departments.map<DeptReportData>((dept) => {
    const evaluation = evaluateDept(dept, audits, tasks, range, now);
    const periodAudits = audits.filter((a) => a.dept === dept.id && a.date >= range.from && a.date <= range.to);
    const overdueTaskIds = tasks
      .filter((t) => t.dept === dept.id && t.status === 'open' && t.due < now)
      .map((t) => t.id);
    return {
      dept,
      evaluation,
      summary: buildSummary(dept, audits, tasks, range, now),
      topNo: topNoCheckpoints(periodAudits, dept.checkpoints, 3),
      overdueTaskIds,
    };
  });

  items.sort(
    (a, b) =>
      STATUS_RANK[a.evaluation.status] - STATUS_RANK[b.evaluation.status] ||
      a.dept.position - b.dept.position ||
      a.dept.name.localeCompare(b.dept.name),
  );
  return { ok: true, data: { today: now, range, period, items } };
}

/**
 * Panel va «Bo'limim» uchun hisobot: xom yozuvlarni (auditlar) domain hisobi bilan birlashtiradi.
 * Hisob mantig'i bu yerda YO'Q — faqat chaqiriladi.
 */

import { openAt, overdueAt, staffBreakdown } from '@/modules/auditlar/domain';
import type { Actor } from '@/shared/actor';
import { ok, type Res } from '@/shared/result';
import { todayTashkent } from '@/shared/time';

import {
  buildSummary,
  type DeptReportData,
  evaluateDept,
  interactionBreakdown,
  type PeriodKey,
  periodRange,
  type Range,
  type Report,
  STATUS_RANK,
  topNoCheckpoints,
} from '../domain';

import type { ReportDeps } from './ports';

export function parsePeriod(value: string | undefined): PeriodKey {
  return value === 'today' || value === '30' ? value : '7';
}

export async function loadReport(deps: ReportDeps, actor: Actor, period: PeriodKey, deptId?: string): Promise<Res<Report>> {
  const today = todayTashkent(deps.now());
  const r = await loadReportForRange(deps, actor, periodRange(period, today), today, deptId);
  if (!r.ok) return r;
  return ok({ ...r.data, period });
}

/**
 * Ixtiyoriy davr uchun hisobot (haftalik hisobot ham shuni ishlatadi). `asOf` — «bugun» o'rnida
 * muddati o'tgan topshiriqlar hisoblanadigan kun: o'tgan hafta uchun hafta oxiri, joriy uchun bugun.
 */
export async function loadReportForRange(
  deps: ReportDeps,
  actor: Actor,
  range: Range,
  asOf: string,
  deptId?: string,
): Promise<Res<Omit<Report, 'period'> & { period?: PeriodKey }>> {
  const res = await deps.summary.load(actor, { dept: deptId, from: range.prevFrom, to: asOf });
  if (!res.ok) return res;
  const { departments, audits, tasks } = res.data;

  const items = departments.map<DeptReportData>((dept) => {
    const deptTasks = tasks.filter((t) => t.dept === dept.id);
    const periodAudits = audits.filter((a) => a.dept === dept.id && a.date >= range.from && a.date <= range.to);
    return {
      dept,
      evaluation: evaluateDept(dept, audits, tasks, range, asOf),
      summary: buildSummary(dept, audits, tasks, range, asOf),
      topNo: topNoCheckpoints(periodAudits, dept.checkpoints, 3),
      staff: staffBreakdown(periodAudits, dept.checkpoints),
      interactions: interactionBreakdown(periodAudits, dept.checkpoints, new Map(dept.staff.map((s) => [s.id, s.name]))),
      overdueTaskIds: overdueAt(deptTasks, asOf).map((t) => t.id),
      openCount: openAt(deptTasks, asOf).length,
    };
  });

  items.sort(
    (a, b) =>
      STATUS_RANK[a.evaluation.status] - STATUS_RANK[b.evaluation.status] ||
      a.dept.position - b.dept.position ||
      a.dept.name.localeCompare(b.dept.name),
  );
  return ok({ today: asOf, range, items });
}

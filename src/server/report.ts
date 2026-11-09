/**
 * Panel va «Bo'limim» uchun hisobot: xom yozuvlarni (server/qc.ts) calc.ts bilan birlashtiradi.
 * Hisob mantig'i bu yerda YO'Q — faqat chaqiriladi.
 */


import type { DeptDto } from '@/modules/bolimlar/domain';

import { getSummaryData } from '@/modules/auditlar';
import type { Ctx } from '@/shared/context';
import type { Res } from '@/shared/result';

import { openAt, overdueAt, staffBreakdown, type StaffBreakdownRow } from '@/modules/auditlar/domain';
import { buildSummary, type DeptEvaluation, evaluateDept, interactionBreakdown, type InteractionRow, type PeriodKey, periodRange, type Range, STATUS_RANK, type Summary, type TopNo, topNoCheckpoints } from '@/modules/hisobot/domain';
import type { Actor } from '@/shared/actor';
import { todayTashkent } from '@/shared/time';

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
  const r = await loadReportForRange(actor, periodRange(period, now), now, deptId, ctx);
  if (!r.ok) return r;
  return { ok: true, data: { ...r.data, period } };
}

/**
 * Ixtiyoriy davr uchun hisobot (haftalik hisobot ham shuni ishlatadi). `asOf` — «bugun» o'rnida
 * muddati o'tgan topshiriqlar hisoblanadigan kun: o'tgan hafta uchun hafta oxiri, joriy uchun bugun.
 */
export async function loadReportForRange(
  actor: Actor,
  range: Range,
  asOf: string,
  deptId?: string,
  ctx?: Ctx,
): Promise<Res<Omit<Report, 'period'> & { period?: PeriodKey }>> {
  const res = await getSummaryData(actor, { dept: deptId, from: range.prevFrom, to: asOf }, ctx);
  if (!res.ok) return res;
  const { departments, audits, tasks } = res.data;
  const now = asOf;

  const items = departments.map<DeptReportData>((dept) => {
    const evaluation = evaluateDept(dept, audits, tasks, range, now);
    const periodAudits = audits.filter((a) => a.dept === dept.id && a.date >= range.from && a.date <= range.to);
    const overdueTaskIds = overdueAt(
      tasks.filter((t) => t.dept === dept.id),
      now,
    ).map((t) => t.id);
    return {
      dept,
      evaluation,
      summary: buildSummary(dept, audits, tasks, range, now),
      topNo: topNoCheckpoints(periodAudits, dept.checkpoints, 3),
      staff: staffBreakdown(periodAudits, dept.checkpoints),
      interactions: interactionBreakdown(periodAudits, dept.checkpoints, new Map(dept.staff.map((s) => [s.id, s.name]))),
      overdueTaskIds,
      openCount: openAt(
        tasks.filter((t) => t.dept === dept.id),
        now,
      ).length,
    };
  });

  items.sort(
    (a, b) =>
      STATUS_RANK[a.evaluation.status] - STATUS_RANK[b.evaluation.status] ||
      a.dept.position - b.dept.position ||
      a.dept.name.localeCompare(b.dept.name),
  );
  return { ok: true, data: { today: now, range, items } };
}

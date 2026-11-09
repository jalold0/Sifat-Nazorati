/**
 * Bo'lim ko'rsatkichlari (5 ta) va umumiy holat — SOF.
 */

import type { Range } from './period';
import { type Status, trafficCount, trafficPct, worst } from './status';
import { type AuditRec, onTimePct, overdueAt, scoreByLists, type TaskRec } from '@/modules/auditlar/domain';
import type { DeptInput } from '@/modules/bolimlar/domain';
import type { ListKind } from '@/shared/lists';
import { inRange } from '@/shared/time';

/** Topshiriqlar muddatida bajarilishi me'yori, % (taxminiy). */
export const TASK_NORM = 80;

// ── Bo'lim ko'rsatkichlari ───────────────────────────────────────────────────

export type MetricKey = 'score' | 'critical' | 'ontime' | 'overdue' | 'count';

export interface Metric {
  key: MetricKey;
  label: string;
  value: number | null;
  /** null — me'yor yo'q (faqat ma'lumot). */
  norm: number | null;
  direction: '>=' | '<=' | null;
  unit: 'pct' | 'count';
  status: Status | 'info';
  /** Me'yor taxminiy (rahbar tasdiqlamagan). */
  estimate: boolean;
}

export interface DeptEvaluation {
  deptId: string;
  metrics: [Metric, Metric, Metric, Metric, Metric];
  status: Status;
  estimate: boolean;
  auditCount: number;
  criticalCount: number;
  overdueCount: number;
  scorePct: number | null;
  /** Cheklist bo'yicha ball (shu davrda tekshiruvi bor cheklistlar). */
  scoreByList: Partial<Record<ListKind, number | null>>;
}

export function periodMetrics(
  dept: DeptInput,
  audits: AuditRec[],
  tasks: TaskRec[],
  from: string,
  to: string,
  asOf: string,
) {
  const inPeriod = audits.filter((a) => a.dept === dept.id && inRange(a.date, from, to));
  const deptTasks = tasks.filter((t) => t.dept === dept.id);
  const score = scoreByLists(inPeriod, dept.checkpoints);
  return {
    inPeriod,
    deptTasks,
    scorePct: score.pct,
    byList: score.byList,
    criticalCount: inPeriod.filter((a) => a.critical).length,
    ontime: onTimePct(deptTasks, from, to),
    overdue: overdueAt(deptTasks, asOf).length,
  };
}

export function evaluateDept(
  dept: DeptInput,
  audits: AuditRec[],
  tasks: TaskRec[],
  range: Pick<Range, 'from' | 'to'>,
  today: string,
): DeptEvaluation {
  const p = periodMetrics(dept, audits, tasks, range.from, range.to, today);
  const hasAudits = p.inPeriod.length > 0;
  const hasTasks = p.deptTasks.length > 0;

  const metrics: DeptEvaluation['metrics'] = [
    {
      key: 'score',
      label: 'Umumiy ball, %',
      value: p.scorePct,
      norm: dept.norm,
      direction: '>=',
      unit: 'pct',
      status: trafficPct(p.scorePct, dept.norm),
      estimate: dept.estimate,
    },
    {
      key: 'critical',
      label: 'Jiddiy holatlar',
      value: hasAudits ? p.criticalCount : null,
      norm: 0,
      direction: '<=',
      unit: 'count',
      status: trafficCount(hasAudits ? p.criticalCount : null),
      estimate: false,
    },
    {
      key: 'ontime',
      label: 'Topshiriqlar muddatida bajarilishi, %',
      value: p.ontime,
      norm: TASK_NORM,
      direction: '>=',
      unit: 'pct',
      status: trafficPct(p.ontime, TASK_NORM),
      estimate: true,
    },
    {
      key: 'overdue',
      label: 'Muddati o‘tgan ochiq topshiriqlar',
      value: hasTasks ? p.overdue : null,
      norm: 0,
      direction: '<=',
      unit: 'count',
      status: trafficCount(hasTasks ? p.overdue : null),
      estimate: false,
    },
    {
      key: 'count',
      label: 'Tekshiruvlar soni',
      value: p.inPeriod.length,
      norm: null,
      direction: null,
      unit: 'count',
      status: 'info',
      estimate: false,
    },
  ];

  let status = worst(metrics.slice(0, 4).map((m) => m.status as Status));
  if (p.criticalCount > 0) status = 'red';

  return {
    deptId: dept.id,
    metrics,
    status,
    estimate: dept.estimate,
    auditCount: p.inPeriod.length,
    criticalCount: p.criticalCount,
    overdueCount: p.overdue,
    scorePct: p.scorePct,
    scoreByList: p.byList,
  };
}

/**
 * Eng ko'p «Yo'q» olgan nuqtalar va 3 qatorli xulosa — SOF.
 */

import { periodMetrics } from './evaluate';
import type { Range } from './period';
import { type AuditRec, overdueAt, type TaskRec } from '@/modules/auditlar/domain';
import type { Checkpoint, DeptInput } from '@/modules/bolimlar/domain';
import { inRange } from '@/shared/time';

/** Xulosa chiqarish uchun davrdagi eng kam tekshiruv soni. */
export const MIN_SAMPLE = 5;

export interface TopNo {
  id: string;
  text: string;
  count: number;
}

export function topNoCheckpoints(audits: AuditRec[], checkpoints: Checkpoint[], limit = 3): TopNo[] {
  const counts = new Map<string, number>();
  for (const a of audits) {
    for (const [id, ans] of Object.entries(a.answers)) {
      if (ans === 'no') counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const order = new Map(checkpoints.map((c, i) => [c.id, i]));
  return checkpoints
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .map((c) => ({ id: c.id, text: c.text, count: counts.get(c.id) as number }))
    .sort((a, b) => b.count - a.count || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .slice(0, limit);
}

// ── 3 qatorli xulosa ─────────────────────────────────────────────────────────

export interface Summary {
  kind: 'none' | 'small' | 'ok';
  lines: string[];
}

const fmtPct = (v: number) => `${Math.round(v)}%`;

interface Compared {
  label: string;
  from: string;
  to: string;
  /** Musbat — yomonlashdi; manfiy — yaxshilandi. Turli birliklar solishtirilishi uchun «punkt»ga keltirilgan. */
  worsening: number;
}

function compare(dept: DeptInput, audits: AuditRec[], tasks: TaskRec[], range: Range, today: string): Compared[] {
  const cur = periodMetrics(dept, audits, tasks, range.from, range.to, today);
  const prev = periodMetrics(dept, audits, tasks, range.prevFrom, range.prevTo, range.prevTo);
  const out: Compared[] = [];

  if (cur.scorePct !== null && prev.scorePct !== null) {
    out.push({
      label: 'Umumiy ball',
      from: fmtPct(prev.scorePct),
      to: fmtPct(cur.scorePct),
      worsening: prev.scorePct - cur.scorePct,
    });
  }
  if (cur.ontime !== null && prev.ontime !== null) {
    out.push({
      label: 'Topshiriqlar muddatida bajarilishi',
      from: fmtPct(prev.ontime),
      to: fmtPct(cur.ontime),
      worsening: prev.ontime - cur.ontime,
    });
  }
  if (cur.inPeriod.length > 0 && prev.inPeriod.length > 0) {
    // Har bir jiddiy holat 10 punkt bilan tenglashtiriladi
    out.push({
      label: 'Jiddiy holatlar',
      from: String(prev.criticalCount),
      to: String(cur.criticalCount),
      worsening: (cur.criticalCount - prev.criticalCount) * 10,
    });
  }
  if (prev.deptTasks.length > 0 || cur.deptTasks.length > 0) {
    out.push({
      label: 'Muddati o‘tgan topshiriqlar',
      from: String(prev.overdue),
      to: String(cur.overdue),
      worsening: (cur.overdue - prev.overdue) * 10,
    });
  }
  return out;
}

export function buildSummary(
  dept: DeptInput,
  audits: AuditRec[],
  tasks: TaskRec[],
  range: Range,
  today: string,
): Summary {
  const inPeriod = audits.filter((a) => a.dept === dept.id && inRange(a.date, range.from, range.to));
  if (inPeriod.length === 0) return { kind: 'none', lines: ['Bu davrda tekshiruv yo‘q'] };
  if (inPeriod.length < MIN_SAMPLE) {
    return {
      kind: 'small',
      lines: [
        `Namuna kichik (${inPeriod.length} ta tekshiruv): xulosa chiqarilmaydi, tekshiruv hajmini oshiring`,
      ],
    };
  }

  const cmp = compare(dept, audits, tasks, range, today);
  const worse = cmp.filter((c) => c.worsening > 0).sort((a, b) => b.worsening - a.worsening)[0];
  const better = cmp.filter((c) => c.worsening < 0).sort((a, b) => a.worsening - b.worsening)[0];

  const top = topNoCheckpoints(inPeriod, dept.checkpoints, 1)[0];
  const overdue = overdueAt(
    tasks.filter((t) => t.dept === dept.id),
    today,
  ).length;
  const first = top
    ? `Birinchi navbatda: «${top.text}» — ${top.count} marta «Yo‘q»; muddati o‘tgan topshiriqlar: ${overdue} ta.`
    : `Birinchi navbatda: «Yo‘q» javoblar yo‘q; muddati o‘tgan topshiriqlar: ${overdue} ta.`;

  return {
    kind: 'ok',
    lines: [
      worse ? `Yomonlashdi: ${worse.label} ${worse.from} dan ${worse.to} ga.` : 'Yomonlashdi: Yomonlashgani yo‘q.',
      better
        ? `Yaxshilandi: ${better.label} ${better.from} dan ${better.to} ga.`
        : 'Yaxshilandi: Yaxshilanish yo‘q.',
      first,
    ],
  };
}

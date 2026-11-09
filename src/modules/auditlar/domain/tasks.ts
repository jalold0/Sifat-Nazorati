/**
 * Topshiriq qoidalari: muddati o'tgan, ochiq, muddatida bajarilish — SOF.
 */

import type { TaskRec } from './types';
import { inRange } from '@/shared/time';

/** asOf kuniga muddati o'tgan ochiq topshiriqlar: due < asOf va o'sha kungacha yopilmagan. */
export function overdueAt(tasks: TaskRec[], asOf: string): TaskRec[] {
  return tasks.filter((t) => {
    if (t.due >= asOf) return false;
    const closedBy = t.status === 'closed' && (t.closedAt ?? '') !== '' && (t.closedAt as string) <= asOf;
    return !closedBy;
  });
}

/** asOf kuniga ochiq topshiriqlar: shu kungacha yaratilgan va shu kungacha yopilmagan. */
export function openAt(tasks: TaskRec[], asOf: string): TaskRec[] {
  return tasks.filter((t) => {
    if (t.createdOn && t.createdOn > asOf) return false;
    const closedBy = t.status === 'closed' && (t.closedAt ?? '') !== '' && (t.closedAt as string) <= asOf;
    return !closedBy;
  });
}

/** Muddati [from, to] ga tushgan topshiriqlar: muddatigacha yopilganlar ulushi. */
export function onTimePct(tasks: TaskRec[], from: string, to: string): number | null {
  const due = tasks.filter((t) => inRange(t.due, from, to));
  if (due.length === 0) return null;
  const ok = due.filter((t) => t.status === 'closed' && !!t.closedAt && t.closedAt <= t.due).length;
  return (ok / due.length) * 100;
}

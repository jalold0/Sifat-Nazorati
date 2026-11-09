import { canEditReport, canSeeReport } from '@/modules/foydalanuvchilar/domain';
import type { Actor } from '@/shared/actor';
import { bad, forbidden, ok, type Res } from '@/shared/result';
import { todayTashkent } from '@/shared/time';

import { NOTE_MAX, validateWeek, type WeeklyReport, weekRange } from '../domain';

import type { ReportDeps } from './ports';
import { loadReportForRange } from './report';

/** Hafta bo'yicha xom yozuvlar (12 bo'lim) va rahbar izohi. `week` — dushanba, kelajak bo'lmasin. */
export async function getWeeklyReport(deps: ReportDeps, actor: Actor, week: unknown): Promise<Res<WeeklyReport>> {
  if (!canSeeReport(actor)) return forbidden('Haftalik hisobot sizning rolingiz uchun emas.');
  const today = todayTashkent(deps.now());
  const v = validateWeek(week, today);
  if (!v.ok) return bad(v.error);

  const range = weekRange(v.week);
  const asOf = range.to < today ? range.to : today;
  const rep = await loadReportForRange(deps, actor, range, asOf);
  if (!rep.ok) return rep;

  const note = await deps.notes().find(v.week);
  const counts = { green: 0, yellow: 0, red: 0, gray: 0 };
  for (const i of rep.data.items) counts[i.evaluation.status] += 1;

  return ok({
    week: v.week,
    to: range.to,
    report: rep.data as WeeklyReport['report'],
    note: note?.note ?? '',
    noteBy: note?.byName ?? null,
    noteAt: note?.updatedAt.toISOString() ?? null,
    counts,
    canEdit: canEditReport(actor),
  });
}

/** Rahbar izohini saqlash (faqat rahbar). `by` va vaqtni server qo'yadi. */
export async function saveReportNote(deps: ReportDeps, actor: Actor, week: unknown, note: unknown): Promise<Res<{ week: string }>> {
  if (!canEditReport(actor)) return forbidden('Izohni faqat rahbar yoza oladi.');
  const v = validateWeek(week, todayTashkent(deps.now()));
  if (!v.ok) return bad(v.error);
  if (typeof note !== 'string') return bad('Izoh matn bo‘lishi kerak.');
  const text = note.trim();
  if (text.length > NOTE_MAX) return bad(`Izoh ${NOTE_MAX} belgidan oshmasin.`);

  await deps.uow.run(async (tx) => {
    const prev = await deps.notes(tx).find(v.week);
    await deps.notes(tx).save(v.week, text, actor.id);
    await deps.journal(tx).write({
      actorId: actor.id,
      action: 'report.note',
      entity: 'QcReport',
      entityId: v.week,
      summary: `Haftalik hisobot izohi (${v.week}) ${prev ? 'o‘zgartirildi' : 'yozildi'}`,
      details: prev ? { before: prev.note } : undefined,
    });
  });
  return ok({ week: v.week });
}

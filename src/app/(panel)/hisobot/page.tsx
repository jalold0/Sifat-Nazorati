import type { Metadata } from 'next';
import Link from 'next/link';

import { AutoRefresh } from '@/components/qc/auto-refresh';
import { pct } from '@/components/qc/dept-report';
import { PageHead } from '@/components/ui';
import { requireActorFor } from '@/lib/auth';
import { date as fmtDate } from '@/lib/format';
import { addDays, todayTashkent, type Status } from '@/qc/calc';
import { defaultWeek, mondayOf, validateWeek } from '@/qc/training';
import { getWeeklyReport } from '@/server/training';

import { NoteForm, PrintButton } from './report-tools';

export const metadata: Metadata = { title: 'Haftalik hisobot' };
export const dynamic = 'force-dynamic';

/** Rang yonida matn belgisi: qora-oq printerda ham farqlanadi. */
const WORD: Record<Status, string> = { green: 'yashil', yellow: 'sariq', red: 'qizil', gray: 'ma‘lumot yo‘q' };
const MARK: Record<Status, string> = { green: 'bg-ok', yellow: 'bg-warn', red: 'bg-bad', gray: 'bg-muted/50' };

export default async function HisobotPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const actor = await requireActorFor('HEAD', 'INSPECTOR');
  const today = todayTashkent();
  const sp = await searchParams;
  const asked = validateWeek(sp.w, today);
  const week = asked.ok ? asked.week : defaultWeek(today);

  const res = await getWeeklyReport(actor, week);
  if (!res.ok) return <p className="text-bad">{res.error}</p>;
  const { report, note, noteBy, noteAt, counts, canEdit, to } = res.data;
  const items = report.items;
  const reds = items.filter((i) => i.evaluation.status === 'red');

  const prev = addDays(week, -7);
  const next = addDays(week, 7);
  const hasNext = next <= mondayOf(today);

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageHead
        eyebrow="Rahbarga hisobot"
        title="Haftalik hisobot"
        actions={
          <>
            <Link href={`/hisobot?w=${prev}`} className="btn-ghost min-h-[44px]">
              ← Oldingi
            </Link>
            {hasNext ? (
              <Link href={`/hisobot?w=${next}`} className="btn-ghost min-h-[44px]">
                Keyingi →
              </Link>
            ) : (
              <span className="btn-ghost min-h-[44px] opacity-50" aria-disabled>
                Keyingi →
              </span>
            )}
            <PrintButton />
          </>
        }
      />

      <article className="report-doc card p-card">
        <header className="mb-4 border-b border-grid pb-3">
          <p className="eyebrow">iPOST · Sifat nazorati</p>
          <h2 className="text-title">Haftalik hisobot: {fmtDate(week)} – {fmtDate(to)}</h2>
          <p className="mt-1 text-meta text-ink2">
            Umumiy xulosa: yashil <b className="tnum">{counts.green}</b>, sariq <b className="tnum">{counts.yellow}</b>, qizil{' '}
            <b className="tnum">{counts.red}</b>, ma‘lumot yo‘q <b className="tnum">{counts.gray}</b> (jami {items.length} bo‘lim).
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="report-table w-full border-collapse text-meta">
            <thead>
              <tr>
                <th className="th">Bo‘lim</th>
                <th className="th text-right">Ball</th>
                <th className="th">Holat</th>
                <th className="th text-right">Jiddiy</th>
                <th className="th text-right">Ochiq</th>
                <th className="th text-right">Muddati o‘tgan</th>
                <th className="th">Eng ko‘p «Yo‘q» olgan nuqta</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ dept, evaluation, topNo, openCount }) => {
                const st = evaluation.status;
                const top = topNo[0];
                return (
                  <tr key={dept.id}>
                    <td className="td font-semibold">
                      {dept.name}
                      {dept.estimate ? <span className="ml-1 text-micro font-normal text-muted">(taxminiy)</span> : null}
                    </td>
                    <td className="td-num">{evaluation.scorePct === null ? '—' : pct(evaluation.scorePct)}</td>
                    <td className="td whitespace-nowrap">
                      <span aria-hidden className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ${MARK[st]}`} />
                      <span className="font-semibold">{WORD[st]}</span>
                    </td>
                    <td className="td-num">{evaluation.metrics[1].value ?? '—'}</td>
                    <td className="td-num">{evaluation.metrics[3].value === null ? '—' : openCount}</td>
                    <td className="td-num">{evaluation.metrics[3].value ?? '—'}</td>
                    <td className="td">{top ? `${top.text} (${top.count})` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {reds.length > 0 ? (
          <section className="mt-4">
            <h3 className="mb-1.5 text-body font-semibold">Qizil bo‘limlar</h3>
            <ul className="red-list space-y-2">
              {reds.map(({ dept, summary }) => (
                <li key={dept.id} className="red-block text-meta">
                  <p className="font-semibold">{dept.name}</p>
                  <ul className="mt-0.5 text-ink2">
                    {summary.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-4">
          <h3 className="mb-1.5 text-body font-semibold">Rahbar izohi</h3>
          {canEdit ? (
            <NoteForm week={week} initial={note} />
          ) : note ? (
            <p className="whitespace-pre-wrap text-meta">{note}</p>
          ) : (
            <p className="text-meta text-muted">Izoh yozilmagan</p>
          )}
          {note && noteBy && noteAt ? (
            <p className="mt-1 text-micro text-muted">
              {noteBy}, {fmtDate(noteAt)}
            </p>
          ) : null}
        </section>
      </article>
    </>
  );
}

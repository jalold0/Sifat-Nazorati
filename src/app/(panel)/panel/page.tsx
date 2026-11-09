import clsx from 'clsx';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DeptReport, pct, PeriodTabs, StatusDot, StatusLabel } from '@/modules/hisobot/ui';
import { AutoRefresh } from '@/shared/ui/auto-refresh';
import { Badge, Empty, PageHead } from '@/shared/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { listTasks } from '@/modules/auditlar';
import { loadReport, parsePeriod } from '@/modules/hisobot';

export const metadata: Metadata = { title: 'Panel' };
export const dynamic = 'force-dynamic';

const BORDER = {
  red: 'border-l-bad',
  yellow: 'border-l-warn',
  green: 'border-l-ok',
  gray: 'border-l-muted/50',
} as const;

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ p?: string; d?: string }> }) {
  const actor = await requireActorFor('HEAD');
  const sp = await searchParams;
  const period = parsePeriod(sp.p);
  const res = await loadReport(actor, period);

  if (!res.ok) return <p className="text-bad">{res.error}</p>;
  const { items, today } = res.data;
  const selected = items.find((i) => i.dept.id === sp.d);

  let overdue: Awaited<ReturnType<typeof listTasks>> | null = null;
  if (selected) overdue = await listTasks(actor, { dept: selected.dept.id, status: 'open', dueBefore: today });

  const redCount = items.filter((i) => i.evaluation.status === 'red').length;

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHead
        eyebrow="Holat bir qarashda"
        title="Panel"
        lede={
          items.length === 0
            ? undefined
            : redCount > 0
              ? `${redCount} ta bo‘lim qizil`
              : 'Qizil bo‘lim yo‘q'
        }
        actions={<PeriodTabs base="/panel" period={period} />}
      />

      {items.length === 0 ? (
        <Empty>Faol bo‘lim yo‘q. Sozlamalarda bo‘lim qo‘shing.</Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ dept, evaluation }) => {
            const st = evaluation.status;
            const isSel = dept.id === sp.d;
            return (
              <li key={dept.id}>
                <Link
                  href={`/panel?p=${period}&d=${dept.id}#batafsil`}
                  aria-current={isSel ? 'true' : undefined}
                  className={clsx(
                    'card block min-h-[96px] border-l-[5px] p-3.5 transition hover:bg-raised',
                    BORDER[st],
                    isSel && 'ring-2 ring-brand/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-body font-semibold leading-snug">{dept.name}</p>
                    <StatusDot status={st} className="mt-1.5" />
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="tnum text-stat">{evaluation.scorePct === null ? '—' : pct(evaluation.scorePct)}</p>
                    <div className="flex flex-col items-end gap-1">
                      <StatusLabel status={st} />
                      <span className="flex flex-wrap justify-end gap-1">
                        {evaluation.criticalCount > 0 ? (
                          <Badge tone="bad">Jiddiy: {evaluation.criticalCount}</Badge>
                        ) : null}
                        {dept.estimate ? <Badge tone="warn">taxminiy</Badge> : null}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-micro text-muted">
                    {evaluation.auditCount === 0 ? 'Bu davrda tekshiruv yo‘q' : `${evaluation.auditCount} ta tekshiruv`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <section id="batafsil" className="mt-8 scroll-mt-28">
          <DeptReport
            data={selected}
            overdueTasks={overdue?.ok ? overdue.data : []}
            today={today}
            canClose
          />
        </section>
      ) : null}
    </>
  );
}

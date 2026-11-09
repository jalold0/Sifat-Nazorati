import clsx from 'clsx';
import Link from 'next/link';

import { Badge, Card, CardHead } from '@/shared/ui';
import type { TaskDto } from '@/modules/auditlar';


import { InteractionCard, StaffBreakdownCard } from './staff-cards';
import { StatusDot, StatusLabel, STATUS_TEXT_COLOR } from './status';
import { TaskList } from '@/modules/auditlar/ui';

import { type DeptReportData, type Metric, PERIOD_LABEL, type PeriodKey } from '../domain';
import { LIST_LABEL, type ListKind } from '@/shared/lists';

export const pct = (v: number) => `${Math.round(v * 10) / 10}%`.replace('.', ',');

function metricValue(m: Metric): string {
  if (m.value === null) return '—';
  return m.unit === 'pct' ? pct(m.value) : String(m.value);
}

function metricNorm(m: Metric): string | null {
  if (m.norm === null || m.direction === null) return null;
  return `Me‘yor ${m.direction === '>=' ? '≥' : '≤'} ${m.unit === 'pct' ? `${m.norm}%` : m.norm}`;
}

/** Davr tanlash tugmalari: Bugun / 7 kun / 30 kun. */
export function PeriodTabs({ base, period, extra = '' }: { base: string; period: PeriodKey; extra?: string }) {
  return (
    <div role="group" aria-label="Davr" className="flex flex-wrap gap-2">
      {(['today', '7', '30'] as PeriodKey[]).map((k) => (
        <Link
          key={k}
          href={`${base}?p=${k}${extra}`}
          aria-current={period === k ? 'page' : undefined}
          className={clsx(
            'inline-flex min-h-[44px] items-center rounded-lg border px-4 text-meta font-semibold',
            period === k ? 'border-ink bg-ink text-plane' : 'border-line bg-surface text-ink2 hover:bg-raised',
          )}
        >
          {PERIOD_LABEL[k]}
        </Link>
      ))}
    </div>
  );
}

/** Bitta bo'lim: 5 ko'rsatkich, 3 qatorli xulosa, eng ko'p «Yo'q» olgan 3 nuqta, muddati o'tgan topshiriqlar. */
export function DeptReport({
  data,
  overdueTasks,
  today,
  canClose,
}: {
  data: DeptReportData;
  overdueTasks: TaskDto[];
  today: string;
  canClose: boolean;
}) {
  const { dept, evaluation, summary, topNo } = data;

  return (
    <div className="space-y-section">
      <Card>
        <CardHead
          title={dept.name}
          right={
            <span className="flex items-center gap-2">
              <StatusLabel status={evaluation.status} />
              {evaluation.estimate ? <Badge tone="warn">taxminiy</Badge> : null}
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          {evaluation.metrics.map((m) => {
            const norm = metricNorm(m);
            return (
              <div key={m.key} className="tile p-3">
                <p className="text-micro leading-snug text-ink2">{m.label}</p>
                <p className={clsx('tnum mt-1.5 text-stat', STATUS_TEXT_COLOR[m.status])}>{metricValue(m)}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-micro text-muted">
                  {m.value === null ? <span>ma‘lumot yo‘q</span> : <StatusDot status={m.status} />}
                  {norm ? <span>{norm}</span> : <span>faqat ma‘lumot</span>}
                  {m.estimate && norm ? <span>(taxminiy)</span> : null}
                </p>
              </div>
            );
          })}
        </div>
        {Object.keys(evaluation.scoreByList).length > 1 ? (
          <p className="tnum mt-3 text-meta text-ink2">
            Umumiy ball — cheklistlar o‘rtachasi:{' '}
            {(Object.entries(evaluation.scoreByList) as Array<[ListKind, number | null]>).map(([l, v], i) => (
              <span key={l}>
                {i > 0 ? ', ' : ''}
                {LIST_LABEL[l]} <span className="font-semibold text-ink">{v === null ? '—' : pct(v)}</span>
              </span>
            ))}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHead title="Xulosa" />
        <ul className="space-y-2 text-body">
          {summary.lines.map((line) => (
            <li key={line} className={clsx(summary.kind !== 'ok' && 'text-ink2')}>
              {line}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHead title="Eng ko‘p «Yo‘q» olgan nuqtalar" />
        {topNo.length === 0 ? (
          <p className="text-meta text-muted">Bu davrda «Yo‘q» javob yo‘q</p>
        ) : (
          <ol className="space-y-2">
            {topNo.map((t, i) => (
              <li key={t.id} className="flex items-start gap-3 text-body">
                <span className="tnum w-5 text-muted">{i + 1}.</span>
                <span className="min-w-0 flex-1">{t.text}</span>
                <span className="tnum shrink-0 font-semibold">{t.count} marta</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <InteractionCard rows={data.interactions} />

      <StaffBreakdownCard rows={data.staff} checkpoints={dept.checkpoints} />

      <section>
        <h2 className="mb-3 text-title">Muddati o‘tgan topshiriqlar</h2>
        <TaskList
          tasks={overdueTasks}
          departments={[dept]}
          today={today}
          canClose={canClose}
          showDept={false}
          emptyText="Muddati o‘tgan topshiriq yo‘q"
        />
      </section>
    </div>
  );
}

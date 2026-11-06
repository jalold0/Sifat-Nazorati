import clsx from 'clsx';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AutoRefresh } from '@/components/qc/auto-refresh';
import { TaskList } from '@/components/qc/task-list';
import { PageHead } from '@/components/ui';
import { requireActorFor } from '@/lib/auth';
import { todayTashkent } from '@/qc/calc';
import { canEditTask } from '@/qc/policy';
import { listDepartments, listTaskTab, PAGE_SIZE } from '@/server/qc';

export const metadata: Metadata = { title: 'Topshiriqlar' };
export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'overdue', label: 'Muddati o‘tgan' },
  { key: 'open', label: 'Ochiq' },
  { key: 'closed', label: 'Yopilgan' },
] as const;

export default async function TopshiriqlarPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; d?: string; o?: string }>;
}) {
  const actor = await requireActorFor('HEAD', 'INSPECTOR');
  const sp = await searchParams;
  const tab = TABS.find((x) => x.key === sp.t)?.key ?? 'overdue';
  const offset = Math.max(Number(sp.o) || 0, 0);
  const today = todayTashkent();

  const [departments, res] = await Promise.all([
    listDepartments(actor, { includeInactive: true }),
    listTaskTab(actor, { tab, dept: sp.d || undefined, offset }),
  ]);
  const shown = res.ok ? res.data.rows : [];
  const total = res.ok ? res.data.total : 0;
  const counts = res.ok ? res.data.counts : { overdue: 0, open: 0, closed: 0 };
  const href = (t: string, o = 0) => `/topshiriqlar?t=${t}${sp.d ? `&d=${sp.d}` : ''}${o > 0 ? `&o=${o}` : ''}`;

  return (
    <>
      <AutoRefresh />
      <PageHead eyebrow="«Yo‘q» javobdan chiqqan" title="Topshiriqlar" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((x) => (
          <Link
            key={x.key}
            href={href(x.key)}
            aria-current={tab === x.key ? 'page' : undefined}
            className={clsx(
              'inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 text-meta font-semibold',
              tab === x.key ? 'border-ink bg-ink text-plane' : 'border-line bg-surface text-ink2 hover:bg-raised',
            )}
          >
            {x.label}
            <span className={clsx('tnum rounded-md px-1.5 text-micro', x.key === 'overdue' && counts.overdue > 0 ? 'bg-bad text-white' : 'bg-ink/10')}>
              {counts[x.key]}
            </span>
          </Link>
        ))}
        <form className="ml-auto" action="/topshiriqlar">
          <input type="hidden" name="t" value={tab} />
          <label className="sr-only" htmlFor="d">
            Bo‘lim
          </label>
          <select id="d" name="d" defaultValue={sp.d ?? ''} className="field min-h-[44px] w-auto" >
            <option value="">Hamma bo‘lim</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-ghost ml-2 min-h-[44px]">
            Ko‘rsatish
          </button>
        </form>
      </div>

      {!res.ok ? <p className="text-bad">{res.error}</p> : null}
      <TaskList
        tasks={shown}
        departments={departments}
        today={today}
        canClose={canEditTask(actor)}
        emptyText={tab === 'overdue' ? 'Muddati o‘tgan topshiriq yo‘q' : tab === 'open' ? 'Ochiq topshiriq yo‘q' : 'Hali yopilgan topshiriq yo‘q'}
      />

      {total > PAGE_SIZE ? (
        <nav className="mt-4 flex items-center justify-between text-meta" aria-label="Sahifalar">
          {offset > 0 ? (
            <Link className="btn-ghost min-h-[44px]" href={href(tab, Math.max(offset - PAGE_SIZE, 0))}>
              ← Oldingi
            </Link>
          ) : (
            <span />
          )}
          <span className="tnum text-muted">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
          </span>
          {offset + PAGE_SIZE < total ? (
            <Link className="btn-ghost min-h-[44px]" href={href(tab, offset + PAGE_SIZE)}>
              Keyingi →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

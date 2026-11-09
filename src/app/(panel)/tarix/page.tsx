import clsx from 'clsx';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AutoRefresh } from '@/shared/ui/auto-refresh';
import { Badge, Empty, PageHead } from '@/shared/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { date as fmtDate } from '@/shared/format';
import { listDepartments } from '@/modules/bolimlar';
import { listAudits, PAGE_SIZE } from '@/modules/auditlar';

import { canExport } from '@/modules/foydalanuvchilar/domain';
import { LIST_LABEL } from '@/shared/lists';
import { isYmd } from '@/shared/time';

export const metadata: Metadata = { title: 'Tarix' };
export const dynamic = 'force-dynamic';

export default async function TarixPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; d?: string; o?: string }>;
}) {
  const actor = await requireActorFor('HEAD', 'INSPECTOR', 'SUPERVISOR');
  const sp = await searchParams;
  const from = sp.from && isYmd(sp.from) ? sp.from : '';
  const to = sp.to && isYmd(sp.to) ? sp.to : '';
  const offset = Math.max(Number(sp.o) || 0, 0);

  const departments = await listDepartments(actor, { includeInactive: true });
  const names = new Map(departments.map((d) => [d.id, d.name]));
  const res = await listAudits(actor, { dept: sp.d || undefined, from: from || undefined, to: to || undefined, offset });

  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (sp.d) p.set('d', sp.d);
    for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
    return p.toString();
  };

  const rows = res.ok ? res.data.rows : [];
  const total = res.ok ? res.data.total : 0;

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHead
        eyebrow="Kiritilgan tekshiruvlar"
        title="Tarix"
        actions={
          canExport(actor) ? (
            <a href={`/api/qc/tarix.csv?${qs({})}`} className="btn-ghost min-h-[44px]">
              CSV yuklash
            </a>
          ) : null
        }
      />

      <form action="/tarix" className="card mb-4 grid gap-3 p-3.5 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <div>
          <label className="field-label" htmlFor="from">
            Sanadan
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className="field min-h-[44px]" />
        </div>
        <div>
          <label className="field-label" htmlFor="to">
            Sanagacha
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className="field min-h-[44px]" />
        </div>
        <div>
          <label className="field-label" htmlFor="d">
            Bo‘lim
          </label>
          <select id="d" name="d" defaultValue={sp.d ?? ''} className="field min-h-[44px]">
            <option value="">Hamma bo‘lim</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary min-h-[44px]">
          Saralash
        </button>
      </form>

      {!res.ok ? <p className="text-bad">{res.error}</p> : null}
      {rows.length === 0 ? (
        <Empty>Hali tekshiruv yo‘q</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                href={`/tarix/${a.id}`}
                className={clsx(
                  'card flex min-h-[56px] flex-wrap items-center gap-x-4 gap-y-1 p-3.5 transition hover:bg-raised',
                  a.critical && 'border-bad/60',
                )}
              >
                <span className="tnum w-[88px] text-meta text-ink2">{fmtDate(a.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">
                    {names.get(a.dept) ?? 'Bo‘lim'}
                    {a.list === 'interaction' && a.staffName ? <span className="font-normal text-ink2"> · {a.staffName}</span> : null}
                  </span>
                  <span className="block text-micro text-muted">{LIST_LABEL[a.list]}</span>
                </span>
                <span className="tnum text-body font-semibold">{a.scorePct === null ? '—' : `${Math.round(a.scorePct)}%`}</span>
                <span className="text-meta text-ink2">{a.byName}</span>
                <span className="tnum text-meta text-ink2">«Yo‘q»: {a.noCount}</span>
                {a.critical ? <Badge tone="bad">Jiddiy</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <nav className="mt-4 flex items-center justify-between text-meta" aria-label="Sahifalar">
          {offset > 0 ? (
            <Link className="btn-ghost min-h-[44px]" href={`/tarix?${qs({ o: Math.max(offset - PAGE_SIZE, 0) })}`}>
              ← Yangiroq
            </Link>
          ) : (
            <span />
          )}
          <span className="tnum text-muted">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
          </span>
          {offset + PAGE_SIZE < total ? (
            <Link className="btn-ghost min-h-[44px]" href={`/tarix?${qs({ o: offset + PAGE_SIZE })}`}>
              Eskiroq →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

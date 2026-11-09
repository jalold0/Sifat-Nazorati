import clsx from 'clsx';
import type { Metadata } from 'next';

import { AutoRefresh } from '@/shared/ui/auto-refresh';
import { Badge, Empty, PageHead } from '@/shared/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { dateTime } from '@/shared/format';
import { listProgress } from '@/modules/oquv';

import type { TrainingStatus } from '@/modules/oquv/domain';

export const metadata: Metadata = { title: 'Natijalar' };
export const dynamic = 'force-dynamic';

const STATUS: Record<TrainingStatus, { label: string; tone: 'ok' | 'bad' | 'neutral' }> = {
  passed: { label: 'o‘tdi', tone: 'ok' },
  failed: { label: 'o‘tmadi', tone: 'bad' },
  none: { label: 'boshlamagan', tone: 'neutral' },
};

export default async function NatijalarPage({ searchParams }: { searchParams: Promise<{ d?: string; s?: string }> }) {
  const actor = await requireActorFor('HEAD');
  const sp = await searchParams;
  const res = await listProgress(actor);
  if (!res.ok) return <p className="text-bad">{res.error}</p>;

  const depts = [...new Map(res.data.filter((r) => r.deptId).map((r) => [r.deptId as string, r.deptName as string])).entries()];
  const status = sp.s === 'passed' || sp.s === 'failed' || sp.s === 'none' ? sp.s : '';
  const rows = res.data.filter((r) => (!sp.d || r.deptId === sp.d) && (!status || r.status === status));

  const qs = new URLSearchParams();
  if (sp.d) qs.set('d', sp.d);
  if (status) qs.set('s', status);

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHead
        eyebrow="Rahbar"
        title="O‘quv natijalari"
        actions={
          <a href={`/api/qc/natijalar.csv?${qs}`} className="btn-ghost min-h-[44px]">
            CSV yuklash
          </a>
        }
      />

      <form action="/natijalar" className="card mb-4 grid gap-3 p-3.5 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
        <div>
          <label className="field-label" htmlFor="d">
            Bo‘lim
          </label>
          <select id="d" name="d" defaultValue={sp.d ?? ''} className="field min-h-[44px]">
            <option value="">Hamma bo‘lim</option>
            {depts.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="s">
            Holat
          </label>
          <select id="s" name="s" defaultValue={status} className="field min-h-[44px]">
            <option value="">Hammasi</option>
            <option value="passed">o‘tdi</option>
            <option value="failed">o‘tmadi</option>
            <option value="none">boshlamagan</option>
          </select>
        </div>
        <button type="submit" className="btn-primary min-h-[44px]">
          Saralash
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>Hali natija yo‘q</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const st = STATUS[r.status];
            return (
              <li key={`${r.userId}:${r.deptId ?? ''}`}>
                <details className="card group p-0">
                  <summary className="flex min-h-[56px] cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-3.5">
                    <span className="min-w-[120px] text-body font-semibold">{r.userName}</span>
                    <span className="min-w-0 flex-1 text-meta text-ink2">{r.deptName ?? '—'}</span>
                    <span className="tnum text-meta text-ink2">
                      {r.deptId ? `${r.done} / ${r.total}` : '—'}
                    </span>
                    <span className={clsx('tnum w-12 text-right text-body font-semibold', r.status === 'failed' && 'text-bad', r.status === 'passed' && 'text-ok')}>
                      {r.lastPct === null ? '—' : `${r.lastPct}%`}
                    </span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="tnum w-[108px] text-micro text-muted">{r.lastAt ? dateTime(r.lastAt) : '—'}</span>
                  </summary>
                  <div className="border-t border-grid p-3.5">
                    {r.attempts.length === 0 ? (
                      <p className="text-meta text-muted">
                        {r.deptId ? 'Test hali topshirilmagan.' : 'Hali o‘quvni boshlamagan.'}
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {r.attempts.map((a, i) => (
                          <li key={a.id}>
                            <p className="tnum text-meta font-semibold">
                              {r.attempts.length - i}-urinish · {dateTime(a.at)} · {a.score}/{a.total} ({a.pct}%){' '}
                              <span className={a.passed ? 'text-ok' : 'text-bad'}>{a.passed ? 'o‘tdi' : 'o‘tmadi'}</span>
                            </p>
                            {a.wrong.length > 0 ? (
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-meta text-ink2">
                                {a.wrong.map((w) => (
                                  <li key={w.id}>
                                    <span className="font-semibold">Xato:</span> {w.case}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-meta text-ok">Xato yo‘q</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

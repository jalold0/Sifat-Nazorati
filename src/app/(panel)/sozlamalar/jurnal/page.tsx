import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Empty, PageHead } from '@/shared/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { dateTime } from '@/shared/format';
import { listLog, LOG_PAGE } from '@/modules/jurnal';

export const metadata: Metadata = { title: 'O‘zgarishlar jurnali' };
export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  'audit.update': 'Tekshiruv tuzatildi',
  'audit.delete': 'Tekshiruv o‘chirildi',
  'dept.save': 'Bo‘lim sozlamasi',
  'dept.move': 'Bo‘lim tartibi',
  'task.update': 'Topshiriq tahriri',
  'user.save': 'Foydalanuvchi',
  'report.note': 'Hisobot izohi',
};

export default async function JurnalPage({ searchParams }: { searchParams: Promise<{ o?: string; a?: string }> }) {
  const actor = await requireActorFor('HEAD');
  const sp = await searchParams;
  const offset = Math.max(Number(sp.o) || 0, 0);
  const action = sp.a && LABEL[sp.a] ? sp.a : undefined;
  const res = await listLog(actor, { offset, action });
  if (!res.ok) return <p className="text-bad">{res.error}</p>;
  const { rows, total } = res.data;
  const q = (o: number) => `/sozlamalar/jurnal?o=${o}${action ? `&a=${action}` : ''}`;

  return (
    <>
      <p className="mb-3 text-meta">
        <Link href="/sozlamalar" className="inline-flex min-h-[44px] items-center text-brand hover:underline">
          ← Sozlamalar
        </Link>
      </p>
      <PageHead eyebrow="Rahbar" title="O‘zgarishlar jurnali" lede="Kim, qachon, nimani o‘zgartirgani. Yozuvlar o‘chirilmaydi va o‘zgartirilmaydi." />

      <form action="/sozlamalar/jurnal" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="field-label" htmlFor="a">
            Amal turi
          </label>
          <select id="a" name="a" defaultValue={action ?? ''} className="field min-h-[44px] w-auto">
            <option value="">Hammasi</option>
            {Object.entries(LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-ghost min-h-[44px]">
          Ko‘rsatish
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>Hali o‘zgarish yo‘q</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card p-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="tnum text-meta text-muted">{dateTime(r.at)}</span>
                <span className="text-meta font-semibold">{r.actor}</span>
                <Badge tone={r.action === 'audit.delete' ? 'bad' : 'neutral'}>{LABEL[r.action] ?? r.action}</Badge>
              </div>
              <p className="mt-1 text-body">{r.summary}</p>
            </li>
          ))}
        </ul>
      )}

      {total > LOG_PAGE ? (
        <nav className="mt-4 flex items-center justify-between text-meta" aria-label="Sahifalar">
          {offset > 0 ? (
            <Link className="btn-ghost min-h-[44px]" href={q(Math.max(offset - LOG_PAGE, 0))}>
              ← Yangiroq
            </Link>
          ) : (
            <span />
          )}
          <span className="tnum text-muted">
            {offset + 1}–{Math.min(offset + LOG_PAGE, total)} / {total}
          </span>
          {offset + LOG_PAGE < total ? (
            <Link className="btn-ghost min-h-[44px]" href={q(offset + LOG_PAGE)}>
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

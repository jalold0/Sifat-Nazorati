import clsx from 'clsx';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Empty, PageHead } from '@/components/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { listTraining } from '@/server/training';

import { Program } from './program';

export const metadata: Metadata = { title: 'O‘quv dasturi' };
export const dynamic = 'force-dynamic';

export default async function OquvPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const actor = await requireActorFor('HEAD', 'INSPECTOR');
  const res = await listTraining(actor);
  if (!res.ok) return <p className="text-bad">{res.error}</p>;
  const list = res.data;
  const sp = await searchParams;
  const current = list.find((t) => t.deptId === sp.d) ?? list[0];

  return (
    <>
      <PageHead eyebrow="1 haftalik dastur" title="O‘quv dasturi" lede="Bo‘limni tanlang, kunma-kun topshiriqlarni belgilab boring, so‘ng yakuniy testni topshiring." />
      {!current ? (
        <Empty>O‘quv dasturi hali yuklanmagan. Rahbar `pnpm db:seed` ni ishga tushirishi kerak.</Empty>
      ) : (
        <>
          <div role="group" aria-label="Bo‘lim" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((t) => (
              <Link
                key={t.deptId}
                href={`/oquv?d=${t.deptId}`}
                aria-current={t.deptId === current.deptId ? 'page' : undefined}
                className={clsx(
                  'min-h-[48px] rounded-lg border px-3 py-2 text-meta font-semibold leading-tight transition',
                  t.deptId === current.deptId ? 'border-ink bg-ink text-plane' : 'border-line bg-surface text-ink hover:bg-raised',
                )}
              >
                {t.deptName}
                <span className="tnum mt-0.5 block text-micro font-normal opacity-80">
                  {t.progress.done} / {t.progress.total}
                  {t.status === 'passed' ? ' · o‘tdi' : t.status === 'failed' ? ' · o‘tmadi' : ''}
                </span>
              </Link>
            ))}
          </div>
          <Program key={current.deptId} training={current} />
        </>
      )}
    </>
  );
}

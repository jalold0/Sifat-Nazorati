import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Callout, Empty, PageHead } from '@/components/ui';
import { requireActorFor } from '@/lib/auth';
import { listDepartments } from '@/server/qc';

import { MoveButtons } from './move-buttons';

export const metadata: Metadata = { title: 'Sozlamalar' };
export const dynamic = 'force-dynamic';

export default async function SozlamalarPage() {
  const actor = await requireActorFor('HEAD');
  const departments = await listDepartments(actor, { includeInactive: true });
  const unconfirmed = departments.filter((d) => d.estimate && d.active).length;

  return (
    <>
      <PageHead
        eyebrow="Rahbar"
        title="Sozlamalar"
        actions={
          <>
            <Link href="/sozlamalar/jurnal" className="btn-ghost min-h-[44px]">
              Jurnal
            </Link>
            <Link href="/sozlamalar/foydalanuvchilar" className="btn-ghost min-h-[44px]">
              Foydalanuvchilar
            </Link>
            <Link href="/sozlamalar/yangi" className="btn-primary min-h-[44px]">
              Yangi bo‘lim
            </Link>
          </>
        }
      />

      {unconfirmed > 0 ? (
        <Callout tone="warn" title="Me‘yorlarni tasdiqlang" className="mb-4 mt-0">
          {unconfirmed} ta bo‘limda me‘yor «taxminiy». Boshlang‘ich nuqtalar avtomatik tanlangan: har bir bo‘limda
          eng muhimlarini qoldiring, «jiddiy» belgisini qo‘ying va me‘yorni tasdiqlang.
        </Callout>
      ) : null}

      {departments.length === 0 ? (
        <Empty>Bo‘lim yo‘q. «Yangi bo‘lim» ni bosing.</Empty>
      ) : (
        <ul className="space-y-2">
          {departments.map((d, i) => (
            <li key={d.id} className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5">
              <MoveButtons id={d.id} first={i === 0} last={i === departments.length - 1} />
              <Link href={`/sozlamalar/${d.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="text-body font-semibold">{d.name}</span>
                <span className="ml-2 text-meta text-muted">
                  {d.checkpoints.filter((c) => c.active).length} nuqta · me‘yor {d.norm}%
                </span>
              </Link>
              <span className="flex flex-wrap gap-1.5">
                {d.estimate ? <Badge tone="warn">taxminiy</Badge> : <Badge tone="ok">tasdiqlangan</Badge>}
                {!d.active ? <Badge>yashirin</Badge> : null}
              </span>
              <Link href={`/sozlamalar/${d.id}`} className="btn-ghost min-h-[44px]">
                Tahrirlash
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

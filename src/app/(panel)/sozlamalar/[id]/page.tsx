import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHead } from '@/components/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { listDepartments } from '@/server/qc';

import { DeptForm } from './dept-form';

export const metadata: Metadata = { title: 'Bo‘lim sozlamasi' };
export const dynamic = 'force-dynamic';

export default async function BolimSozlamasiPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActorFor('HEAD');
  const { id } = await params;
  const isNew = id === 'yangi';
  const dept = isNew ? null : (await listDepartments(actor, { includeInactive: true })).find((d) => d.id === id);
  if (!isNew && !dept) notFound();

  return (
    <>
      <p className="mb-3 text-meta">
        <Link href="/sozlamalar" className="inline-flex min-h-[44px] items-center text-brand hover:underline">
          ← Sozlamalar
        </Link>
      </p>
      <PageHead eyebrow={isNew ? 'Yangi bo‘lim' : 'Bo‘lim'} title={dept?.name ?? 'Yangi bo‘lim'} />
      <DeptForm dept={dept ?? null} />
    </>
  );
}

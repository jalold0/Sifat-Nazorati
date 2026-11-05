import type { Metadata } from 'next';

import { Empty, PageHead } from '@/components/ui';
import { requireActorFor } from '@/lib/auth';
import { todayTashkent } from '@/qc/calc';
import { listDepartments } from '@/server/qc';

import { AuditForm } from './audit-form';

export const metadata: Metadata = { title: 'Tekshiruv' };
export const dynamic = 'force-dynamic';

export default async function TekshiruvPage() {
  const actor = await requireActorFor('HEAD', 'INSPECTOR');
  const departments = await listDepartments(actor);
  const today = todayTashkent();

  return (
    <>
      <PageHead eyebrow="Bugungi tekshiruv" title="Tekshiruv kiritish" />
      {departments.length === 0 ? (
        <Empty>Faol bo‘lim yo‘q. Rahbar Sozlamalarda bo‘lim qo‘shishi kerak.</Empty>
      ) : (
        <AuditForm mode="create" departments={departments} today={today} />
      )}
    </>
  );
}

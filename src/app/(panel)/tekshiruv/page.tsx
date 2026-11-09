import type { Metadata } from 'next';

import { Empty, PageHead } from '@/shared/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { listDepartments } from '@/modules/bolimlar';

import { AuditForm } from '@/modules/auditlar/ui';

import { creatableLists } from '@/modules/foydalanuvchilar/domain';
import { todayTashkent } from '@/shared/time';

export const metadata: Metadata = { title: 'Tekshiruv' };
export const dynamic = 'force-dynamic';

export default async function TekshiruvPage() {
  const actor = await requireActorFor('HEAD', 'INSPECTOR', 'SUPERVISOR');
  // Supervayzerga faqat o'z bo'limi keladi (listDepartments bo'lim doirasini o'zi qo'llaydi)
  const departments = await listDepartments(actor);
  const today = todayTashkent();

  return (
    <>
      <PageHead eyebrow="Bugungi tekshiruv" title="Tekshiruv kiritish" />
      {departments.length === 0 ? (
        <Empty>Faol bo‘lim yo‘q. Rahbar Sozlamalarda bo‘lim qo‘shishi kerak.</Empty>
      ) : (
        <AuditForm mode="create" departments={departments} today={today} lists={creatableLists(actor)} />
      )}
    </>
  );
}

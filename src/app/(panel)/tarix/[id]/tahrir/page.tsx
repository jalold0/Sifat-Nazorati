import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AuditForm } from '@/modules/auditlar/ui';
import { PageHead } from '@/components/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { getAudit } from '@/modules/auditlar';

import { todayTashkent } from '@/shared/time';

export const metadata: Metadata = { title: 'Tekshiruvni tuzatish' };
export const dynamic = 'force-dynamic';

export default async function TahrirPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActorFor('HEAD', 'INSPECTOR', 'SUPERVISOR');
  const { id } = await params;
  const res = await getAudit(actor, id);
  if (!res.ok) {
    if (res.status === 404) notFound();
    redirect('/ruxsat-yoq');
  }
  const { audit, dept, tasks, canEdit } = res.data;
  if (!canEdit) redirect(`/tarix/${id}`);

  return (
    <>
      <p className="mb-3 text-meta">
        <Link href={`/tarix/${id}`} className="inline-flex min-h-[44px] items-center text-brand hover:underline">
          ← Tekshiruvga qaytish
        </Link>
      </p>
      <PageHead eyebrow="Tuzatish" title={dept.name} />
      <AuditForm
        mode="edit"
        departments={[dept]}
        today={todayTashkent()}
        initial={{
          id: audit.id,
          deptId: audit.dept,
          date: audit.date,
          subject: audit.subject,
          answers: audit.answers,
          notes: audit.notes,
          tasks,
          staff: audit.staff ?? null,
          list: audit.list,
          staffId: audit.staffId ?? null,
          channel: audit.channel ?? null,
        }}
      />
    </>
  );
}

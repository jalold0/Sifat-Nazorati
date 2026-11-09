import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { StaffCpResult } from '@/components/qc/staff-result';
import { TaskList } from '@/components/qc/task-list';
import { Badge, Card, CardHead, PageHead } from '@/components/ui';
import { requireActorFor } from '@/lib/auth';
import { date as fmtDate, dateTime } from '@/lib/format';
import { getAudit } from '@/server/qc';

import { DeleteAuditButton } from './delete-button';

import { canEditTask } from '@/modules/foydalanuvchilar/domain';
import { CHANNELS, isChannel, LIST_LABEL } from '@/shared/lists';
import { todayTashkent } from '@/shared/time';

export const metadata: Metadata = { title: 'Tekshiruv' };
export const dynamic = 'force-dynamic';

const ANSWER = {
  yes: { label: 'Ha', cls: 'bg-ok/10 text-ok' },
  no: { label: 'Yo‘q', cls: 'bg-bad/10 text-bad' },
  na: { label: 'Tegishli emas', cls: 'bg-ink/[0.06] text-ink2' },
} as const;

export default async function TekshiruvTafsilotPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActorFor('HEAD', 'INSPECTOR', 'SUPERVISOR');
  const { id } = await params;
  const res = await getAudit(actor, id);
  if (!res.ok) {
    if (res.status === 404) notFound();
    redirect('/ruxsat-yoq');
  }
  const { audit, dept, tasks, canEdit, canDelete } = res.data;

  return (
    <>
      <p className="mb-3 text-meta">
        <Link href="/tarix" className="inline-flex min-h-[44px] items-center text-brand hover:underline">
          ← Tarix
        </Link>
      </p>
      <PageHead
        eyebrow={`${fmtDate(audit.date)} · ${LIST_LABEL[audit.list]}`}
        title={audit.list === 'interaction' && audit.staffName ? `${dept.name}: ${audit.staffName}` : dept.name}
        lede={[
          `${audit.byName} kiritgan, ${dateTime(audit.createdAt)}`,
          audit.list === 'interaction' && isChannel(audit.channel) ? CHANNELS[audit.channel] : null,
          audit.subject || null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            {canEdit ? (
              <Link href={`/tarix/${audit.id}/tahrir`} className="btn-ghost min-h-[44px]">
                Tuzatish
              </Link>
            ) : null}
            {canDelete ? <DeleteAuditButton id={audit.id} /> : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="tnum text-stat">{audit.scorePct === null ? '—' : `${Math.round(audit.scorePct)}%`}</span>
        <span className="text-meta text-ink2">ball</span>
        <span className="tnum text-meta text-ink2">«Yo‘q»: {audit.noCount}</span>
        {audit.critical ? <Badge tone="bad">Jiddiy holat</Badge> : null}
      </div>

      <Card>
        <CardHead title="Javoblar" />
        <ol className="divide-y divide-grid">
          {dept.checkpoints
            .filter((c) => audit.answers[c.id])
            .map((c, i) => {
              const a = ANSWER[audit.answers[c.id]!];
              const note = audit.notes[c.id];
              return (
                <li key={c.id} className="py-2.5">
                  <div className="flex items-start gap-3">
                    <span className="tnum w-5 text-meta text-muted">{i + 1}.</span>
                    <p className="min-w-0 flex-1 text-body">
                      {c.text}
                      {c.critical ? <span className="ml-2 text-micro font-semibold text-bad">jiddiy</span> : null}
                      {!c.active ? <span className="ml-2 text-micro text-muted">(yashirilgan nuqta)</span> : null}
                    </p>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-micro font-semibold ${a.cls}`}>{a.label}</span>
                  </div>
                  {note?.text ? (
                    <p className="ml-8 mt-1 text-meta text-ink2">
                      {note.text}
                      {note.ref ? <span className="text-muted"> · dalil: {note.ref}</span> : null}
                    </p>
                  ) : null}
                  <StaffCpResult cp={c} block={audit.staff ?? null} />
                </li>
              );
            })}
        </ol>
      </Card>

      {tasks.length > 0 ? (
        <section className="mt-section">
          <h2 className="mb-3 text-title">Topshiriqlar</h2>
          <TaskList tasks={tasks} departments={[dept]} today={todayTashkent()} canClose={canEditTask(actor)} showDept={false} />
        </section>
      ) : null}
    </>
  );
}

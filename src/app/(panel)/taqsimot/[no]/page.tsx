import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Callout, Card, CardHead, Empty, PageHead, Table } from '@/components/ui';
import { SYSTEM_EPOCH, windowLabel } from '@/domain/assignment';
import { canManageSettings, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { date, dateInputValue, number } from '@/lib/format';
import { taskWithHistory } from '@/server/assignments';
import { KIND_LABEL, PRIORITY_LABEL } from '@/server/shared';

import { ReassignForm } from '../reassign-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  return { title: `Vazifa №${no}` };
}

/**
 * Bitta vazifaning kartochkasi: joriy mas'ul, qayta biriktirish shakli va
 * to'liq tarix — har bir davrda kim javob bergani va nechta murojaat bo'lgani.
 */
export default async function TaskPage({ params }: { params: Promise<{ no: string }> }) {
  const session = await requireSession();
  const { no } = await params;
  const taskNo = Number(no);
  if (!Number.isInteger(taskNo)) notFound();

  const task = await taskWithHistory(taskNo);
  if (!task) notFound();

  const users = await db.user.findMany({
    where: { active: true, role: { in: ['HEAD', 'SPECIALIST'] } },
    orderBy: { shortName: 'asc' },
    select: { id: true, shortName: true },
  });

  const canEdit = canManageSettings(session.role);
  const totalTickets = task.history.reduce((s, h) => s + h.ticketCount, 0);

  return (
    <>
      <PageHead
        eyebrow={`Ish taqsimoti · Zona ${task.zoneCode} — ${task.zoneName}`}
        title={`№${task.no}. ${task.title}`}
        lede={`Manba: ${task.source} · davriylik: ${task.frequency}${task.slaHours ? ` · SLA ${task.slaHours} soat` : ''}`}
        actions={
          <Link href="/taqsimot" className="btn-ghost">
            Taqsimotga qaytish
          </Link>
        }
      />

      <div className="grid gap-section lg:grid-cols-[1fr_1.25fr]">
        <Card>
          <CardHead title="Joriy biriktirish" />
          <dl className="divide-y divide-grid">
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-meta text-muted">Mas'ul</dt>
              <dd className="text-body font-semibold">{task.currentOwnerName}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-meta text-muted">Zaxira</dt>
              <dd className="text-body">{task.currentBackupName ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-meta text-muted">Qachondan buyon</dt>
              <dd className="tnum text-body">
                {task.currentSince && task.currentSince.getTime() === SYSTEM_EPOCH.getTime()
                  ? 'boshidan'
                  : date(task.currentSince)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-meta text-muted">Ustuvorlik</dt>
              <dd>
                <Badge tone={task.priority === 'CRITICAL' ? 'bad' : task.priority === 'HIGH' ? 'warn' : 'neutral'}>
                  {PRIORITY_LABEL[task.priority]}
                </Badge>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-meta text-muted">Ish turi</dt>
              <dd>
                <Badge tone={task.kind === 'PROACTIVE' ? 'ok' : 'neutral'}>{KIND_LABEL[task.kind]}</Badge>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-meta text-muted">Jami murojaat</dt>
              <dd className="tnum text-body font-semibold">{number(totalTickets)}</dd>
            </div>
          </dl>
        </Card>

        {canEdit ? (
          <Card>
            <CardHead
              title="Boshqa xodimga biriktirish"
              note="O'zgartirish tarixda sanasi, sababi va kim o'zgartirgani bilan qoladi"
            />
            <ReassignForm
              taskNo={task.no}
              currentOwnerId={task.currentOwnerId}
              currentOwnerName={task.currentOwnerName}
              currentBackupId={task.currentBackupId}
              users={users}
              today={dateInputValue(new Date())}
            />
          </Card>
        ) : (
          <Card>
            <CardHead title="Biriktirishni o'zgartirish" />
            <Empty>Taqsimotni o'zgartirish bo'lim boshlig'i va rahbariyat huquqida.</Empty>
          </Card>
        )}
      </div>

      <Card className="mt-section">
        <CardHead
          title="Biriktirish tarixi"
          note="Har bir davrda kim javob bergan va shu davrda nechta murojaat qayd etilgan"
        />
        <Table>
          <thead>
            <tr>
              <th className="th">Davr</th>
              <th className="th">Mas'ul</th>
              <th className="th">Zaxira</th>
              <th className="th text-right">Murojaat</th>
              <th className="th">Sabab</th>
              <th className="th">Kim o'zgartirdi</th>
            </tr>
          </thead>
          <tbody>
            {task.history.map((h, i) => (
              <tr key={h.id} className={h.until === null ? 'bg-brand/[0.04]' : undefined}>
                <td className="td tnum whitespace-nowrap">
                  {windowLabel(h, (x) => date(x), i === 0)}
                  {h.until === null ? (
                    <Badge tone="brand" className="ml-2">
                      joriy
                    </Badge>
                  ) : null}
                </td>
                <td className="td whitespace-nowrap font-semibold">{h.ownerName}</td>
                <td className="td whitespace-nowrap text-meta text-ink2">{h.backupName ?? '—'}</td>
                <td className="td tnum text-right font-semibold">{number(h.ticketCount)}</td>
                <td className="td text-meta text-ink2">{h.reason ?? '—'}</td>
                <td className="td whitespace-nowrap text-meta text-muted">{h.changedByName ?? 'tizim'}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        {task.unassignedTickets > 0 ? (
          <Callout tone="warn" title="Diqqat: ma'lumot nomutanosib">
            {number(task.unassignedTickets)} ta murojaat hech bir biriktirish davriga tushmadi — ehtimol ular tizim
            kuzatuvi boshlanishidan oldingi sana bilan qayd etilgan. Yig'indi jami murojaat soniga to'g'ri kelmaydi.
          </Callout>
        ) : null}

        <p className="mt-3 text-micro text-muted">
          Sanoq o'zgarish sanasida kesiladi: oraliq [boshlanish, tugash) — kuchga kirish kunidagi murojaat yangi
          mas'ulga tegishli. Shuning uchun bir ish ikki kishida sanalmaydi.
        </p>
      </Card>
    </>
  );
}

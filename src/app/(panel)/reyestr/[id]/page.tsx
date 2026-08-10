import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Callout, Card, CardHead, PageHead, type Tone } from '@/components/ui';
import { hoursBetween, hoursToDeadline, slaState, type SlaState } from '@/domain/sla';
import { canWrite, requireSession } from '@/lib/auth';
import { date, dateTime, dateTimeInputValue, hours, number } from '@/lib/format';
import { getTicket } from '@/server/registry';
import { KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '@/server/shared';

import { markTicketAction } from '../actions';
import { CloseForm } from './close-form';

export const dynamic = 'force-dynamic';

const SLA_BADGE: Record<SlaState, { label: string; tone: Tone }> = {
  ON_TIME: { label: 'Muddatida', tone: 'neutral' },
  AT_RISK: { label: 'Xavf ostida', tone: 'warn' },
  BREACHED: { label: 'Muddat buzildi', tone: 'bad' },
  MET: { label: 'SLA bajarildi', tone: 'ok' },
  LATE_CLOSED: { label: 'Kech yopildi', tone: 'bad' },
};

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const now = new Date();
  const state = slaState(ticket.receivedAt, ticket.closedAt, ticket.slaHours, now);
  const remaining = hoursToDeadline(ticket.receivedAt, ticket.slaHours, now);
  const editable = canWrite(session.role) && ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED';

  const rows: Array<[string, string]> = [
    ['Hisobot sanasi', date(ticket.date)],
    ['Kanal / manba', ticket.channel],
    ['Zona', `${ticket.zoneCode} — ${ticket.zone.name}`],
    ['Vazifa turi', ticket.category],
    ['Katalog vazifasi', ticket.taskDef ? `${ticket.taskDef.no}. ${ticket.taskDef.title}` : '—'],
    ["Ob'ekt", ticket.objectName ?? '—'],
    ['Trek / tashqi ID', ticket.externalRef ?? '—'],
    ["Mas'ul", ticket.owner.shortName],
    ['Ustuvorlik', PRIORITY_LABEL[ticket.priority]],
    ['Ish turi', KIND_LABEL[ticket.kind]],
    ['Qabul qilingan', dateTime(ticket.receivedAt)],
    ['Birinchi javob', ticket.firstResponseAt ? dateTime(ticket.firstResponseAt) : '—'],
    ['Eskalatsiya', ticket.escalatedAt ? dateTime(ticket.escalatedAt) : '—'],
    ['Yopilgan', ticket.closedAt ? dateTime(ticket.closedAt) : '—'],
    ['SLA normasi', `${ticket.slaHours} soat`],
    ['Sarflangan vaqt', ticket.spentHours ? hours(Number(ticket.spentHours)) : '—'],
    ['Kiritdi', `${ticket.createdBy.shortName} · ${dateTime(ticket.createdAt)}`],
  ];

  return (
    <>
      <PageHead
        eyebrow="Kunlik reyestr"
        title={ticket.ref}
        lede={ticket.description}
        actions={
          <>
            <Badge tone={SLA_BADGE[state].tone}>{SLA_BADGE[state].label}</Badge>
            <Badge>{STATUS_LABEL[ticket.status]}</Badge>
            <Link href="/reyestr" className="btn-ghost">
              Reyestrga qaytish
            </Link>
          </>
        }
      />

      {state === 'BREACHED' ? (
        <Callout tone="bad" title="SLA muddati buzilgan">
          Muddat {hours(Math.abs(remaining))} oldin o'tdi. Bu murojaat bo'lim SLA ko'rsatkichini pasaytiradi —
          eskalatsiya qilinganini belgilang yoki yoping.
        </Callout>
      ) : null}
      {state === 'AT_RISK' ? (
        <Callout tone="warn" title="Muddat yaqinlashdi">
          Yopishga {hours(remaining)} qoldi.
        </Callout>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHead title="Murojaat ma'lumotlari" />
          <dl className="divide-y divide-grid">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-[12.5px] text-muted">{label}</dt>
                <dd className="tnum text-right text-[13px] font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          {ticket.firstResponseAt ? (
            <p className="mt-3 text-[12px] text-ink2">
              Birinchi javob {hours(hoursBetween(ticket.receivedAt, ticket.firstResponseAt))} ichida berilgan.
            </p>
          ) : null}

          {editable ? (
            <div className="no-print mt-4 flex flex-wrap gap-2">
              {!ticket.firstResponseAt ? (
                <form action={markTicketAction.bind(null, ticket.id, 'firstResponseAt')}>
                  <button type="submit" className="btn-ghost">
                    Birinchi javob berildi
                  </button>
                </form>
              ) : null}
              {!ticket.escalatedAt ? (
                <form action={markTicketAction.bind(null, ticket.id, 'escalatedAt')}>
                  <button type="submit" className="btn-ghost">
                    Eskalatsiya qilindi
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          {ticket.rootCause || ticket.actionTaken ? (
            <Card>
              <CardHead title="Sabab va chora" />
              <div className="space-y-3">
                <div>
                  <p className="eyebrow mb-1">Sabab (root cause)</p>
                  <p className="text-[13px] leading-relaxed text-ink2">{ticket.rootCause ?? '—'}</p>
                </div>
                <div>
                  <p className="eyebrow mb-1">Ko'rilgan chora</p>
                  <p className="text-[13px] leading-relaxed text-ink2">{ticket.actionTaken ?? '—'}</p>
                </div>
                {ticket.isRepeat ? (
                  <Badge tone="warn">Takroriy muammo — root-cause tahliliga kiritilishi kerak</Badge>
                ) : null}
              </div>
            </Card>
          ) : null}

          {editable ? (
            <Card>
              <CardHead
                title="Murojaatni yopish"
                note="Sabab va chora yozilmasa yopib bo'lmaydi — takrorlanishni to'xtatish uchun"
              />
              <CloseForm
                id={ticket.id}
                now={dateTimeInputValue(now)}
                suggestedHours={String(Math.min(hoursBetween(ticket.receivedAt, now), 24).toFixed(2))}
              />
            </Card>
          ) : null}

          {ticket.status === 'CLOSED' ? (
            <Card>
              <CardHead title="Yakuniy holat" />
              <p className="text-[13px] text-ink2">
                Murojaat {dateTime(ticket.closedAt)} da yopilgan.{' '}
                {ticket.slaMet === true
                  ? 'SLA muddati bajarilgan.'
                  : ticket.slaMet === false
                    ? 'SLA muddati buzilgan — bu ko‘rsatkich oylik hisobotga kiradi.'
                    : ''}{' '}
                Yopishga {hours(hoursBetween(ticket.receivedAt, ticket.closedAt ?? now))} ketgan
                {ticket.spentHours ? `, sarflangan mehnat vaqti ${hours(Number(ticket.spentHours))}` : ''}.
              </p>
              <p className="mt-2 text-[12px] text-muted">
                Sarflangan vaqt zona normasini o'lchashda ishlatiladi — {number(ticket.slaHours)} soatlik SLA bilan
                aralashtirmang.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

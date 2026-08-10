import Link from 'next/link';

import { Badge, Card, Empty, PageHead, StatTile, Table, type Tone } from '@/components/ui';
import { slaState, type SlaState } from '@/domain/sla';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { date, hours, number, percent, time } from '@/lib/format';
import { lastPeriods, periodLabel, periodOf } from '@/lib/period';
import { listTickets, summarise, type RegistryFilter } from '@/server/registry';
import { KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '@/server/shared';

export const metadata = { title: 'Kunlik reyestr' };
export const dynamic = 'force-dynamic';

const SLA_BADGE: Record<SlaState, { label: string; tone: Tone }> = {
  ON_TIME: { label: 'Muddatida', tone: 'neutral' },
  AT_RISK: { label: 'Xavf ostida', tone: 'warn' },
  BREACHED: { label: 'Muddat buzildi', tone: 'bad' },
  MET: { label: 'SLA bajarildi', tone: 'ok' },
  LATE_CLOSED: { label: 'Kech yopildi', tone: 'bad' },
};

const PAGE_SIZE = 60;

export default async function RegistryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSession();
  const sp = await searchParams;

  const period = sp.davr ?? periodOf();
  const page = Math.max(1, Number(sp.sahifa ?? '1') || 1);

  const filter: RegistryFilter = {
    period,
    ownerId: sp.masul || undefined,
    zoneCode: sp.zona || undefined,
    status: (sp.holat as RegistryFilter['status']) || undefined,
    kind: (sp.tur as RegistryFilter['kind']) || undefined,
    priority: (sp.ustuvorlik as RegistryFilter['priority']) || undefined,
    search: sp.qidiruv || undefined,
  };

  const [{ rows, total }, summary, users, periods] = await Promise.all([
    listTickets(filter, { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    summarise(filter),
    db.user.findMany({
      where: { role: { in: ['HEAD', 'SPECIALIST'] } },
      orderBy: { shortName: 'asc' },
      select: { id: true, shortName: true },
    }),
    db.kpiPeriod.findMany({ orderBy: { period: 'desc' }, select: { period: true, label: true } }),
  ]);

  const periodOptions =
    periods.length > 0 ? periods : lastPeriods(6).reverse().map((p) => ({ period: p, label: periodLabel(p) }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();

  const query = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    return `?${next.toString()}`;
  };

  return (
    <>
      <PageHead
        eyebrow={`Kunlik reyestr · ${periodLabel(period)}`}
        title="Barcha murojaatlar"
        lede="Tizimning poydevori: har bir murojaat, uning SLA holati, sarflangan vaqti va sababi."
        actions={
          <Link href="/reyestr/yangi" className="btn-primary">
            Murojaat qo'shish
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Jami" value={number(summary.total)} hint={`${number(summary.closed)} yopilgan`} />
        <StatTile
          label="SLA bajarilishi"
          value={percent(summary.slaDecided > 0 ? summary.slaMet / summary.slaDecided : null)}
          tone={summary.slaDecided > 0 && summary.slaMet / summary.slaDecided >= 0.9 ? 'ok' : 'warn'}
        />
        <StatTile label="Muddat buzilgan" value={number(summary.breached)} tone={summary.breached > 0 ? 'bad' : 'ok'} />
        <StatTile
          label="O'rtacha yopish"
          value={hours(summary.avgCloseHours)}
          hint={`Birinchi javob ${hours(summary.avgFirstResponseHours)}`}
        />
        <StatTile label="Sarflangan vaqt" value={hours(summary.spentHours, 0)} hint="Xronometraj asosi" />
      </div>

      {/* ── Filtrlar ──────────────────────────────────────────────────────── */}
      <Card className="mt-4 no-print" padded={false}>
        <form className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-7" method="get">
          <div>
            <label className="field-label" htmlFor="davr">
              Davr
            </label>
            <select id="davr" name="davr" className="field" defaultValue={period}>
              {periodOptions.map((p) => (
                <option key={p.period} value={p.period}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="masul">
              Mas'ul
            </label>
            <select id="masul" name="masul" className="field" defaultValue={sp.masul ?? ''}>
              <option value="">Hammasi</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.shortName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="zona">
              Zona
            </label>
            <select id="zona" name="zona" className="field" defaultValue={sp.zona ?? ''}>
              <option value="">Hammasi</option>
              {['A', 'B', 'C', 'D'].map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="holat">
              Holat
            </label>
            <select id="holat" name="holat" className="field" defaultValue={sp.holat ?? ''}>
              <option value="">Hammasi</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="tur">
              Ish turi
            </label>
            <select id="tur" name="tur" className="field" defaultValue={sp.tur ?? ''}>
              <option value="">Hammasi</option>
              <option value="PROACTIVE">Proaktiv</option>
              <option value="REACTIVE">Reaktiv</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="qidiruv">
              Qidiruv
            </label>
            <input
              id="qidiruv"
              name="qidiruv"
              className="field"
              defaultValue={sp.qidiruv ?? ''}
              placeholder="ID, trek, tavsif"
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-brand">
              Filtr
            </button>
            <Link href="/reyestr" className="btn-ghost">
              Tozalash
            </Link>
          </div>
        </form>
      </Card>

      {/* ── Jadval ────────────────────────────────────────────────────────── */}
      <Card className="mt-4" padded={false}>
        {rows.length === 0 ? (
          <div className="p-5">
            <Empty>Bu shartlar bo'yicha murojaat topilmadi.</Empty>
          </div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th className="th">ID / sana</th>
                  <th className="th">Kanal · Zona</th>
                  <th className="th">Tavsif</th>
                  <th className="th">Mas'ul</th>
                  <th className="th">Ustuvorlik</th>
                  <th className="th">Holat</th>
                  <th className="th">SLA</th>
                  <th className="th text-right">Vaqt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const state = slaState(t.receivedAt, t.closedAt, t.slaHours, now);
                  const badge = SLA_BADGE[state];
                  return (
                    <tr key={t.id} className="transition hover:bg-raised">
                      <td className="td whitespace-nowrap">
                        <Link href={`/reyestr/${t.id}`} className="font-semibold text-brand">
                          {t.ref}
                        </Link>
                        <p className="tnum mt-0.5 text-[11.5px] text-muted">{date(t.date)}</p>
                      </td>
                      <td className="td whitespace-nowrap text-[12.5px]">
                        {t.channel}
                        <p className="mt-0.5 text-[11.5px] text-muted">
                          Zona {t.zoneCode} · {KIND_LABEL[t.kind]}
                        </p>
                      </td>
                      <td className="td max-w-[320px]">
                        <p className="line-clamp-2 text-[12.5px]">{t.description}</p>
                        {t.objectName ? <p className="mt-0.5 text-[11.5px] text-muted">{t.objectName}</p> : null}
                        {t.isRepeat ? (
                          <Badge tone="warn" className="mt-1">
                            Takroriy
                          </Badge>
                        ) : null}
                      </td>
                      <td className="td whitespace-nowrap text-[12.5px]">{t.owner.shortName}</td>
                      <td className="td">
                        <Badge tone={t.priority === 'CRITICAL' ? 'bad' : t.priority === 'HIGH' ? 'warn' : 'neutral'}>
                          {PRIORITY_LABEL[t.priority]}
                        </Badge>
                      </td>
                      <td className="td whitespace-nowrap text-[12.5px]">{STATUS_LABEL[t.status]}</td>
                      <td className="td">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                        <p className="tnum mt-0.5 text-[11px] text-muted">{t.slaHours} soat</p>
                      </td>
                      <td className="td tnum whitespace-nowrap text-right text-[12px]">
                        <span className="text-ink2">{time(t.receivedAt)}</span>
                        {t.closedAt ? <p className="text-muted">{time(t.closedAt)} yopildi</p> : null}
                        {t.spentHours ? <p className="font-semibold">{hours(Number(t.spentHours))}</p> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            <div className="flex items-center justify-between gap-3 border-t border-grid px-4 py-3">
              <p className="text-[12px] text-muted">
                {number((page - 1) * PAGE_SIZE + 1)}–{number(Math.min(page * PAGE_SIZE, total))} / {number(total)} ta
              </p>
              <div className="no-print flex gap-2">
                {page > 1 ? (
                  <Link href={query({ sahifa: String(page - 1) })} className="btn-ghost">
                    Oldingi
                  </Link>
                ) : null}
                {page < pages ? (
                  <Link href={query({ sahifa: String(page + 1) })} className="btn-ghost">
                    Keyingi
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

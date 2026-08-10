import Link from 'next/link';

import { ColumnChart, BarList, ScoreGauge, SplitBar } from '@/components/charts';
import { Badge, Callout, Card, CardHead, Empty, PageHead, ProgressBar, StatTile, Table } from '@/components/ui';
import { canWrite, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { date, hours, number, percent, score } from '@/lib/format';
import { periodLabel, periodOf } from '@/lib/period';
import { coverage } from '@/server/audits';
import { scorecards } from '@/server/kpi';
import { byChannel, byOwner, byZone, overdueTickets, summarise } from '@/server/registry';
import { CHECKLIST_LABEL, PERIOD_STATUS_LABEL, PRIORITY_LABEL } from '@/server/shared';

export const metadata = { title: 'Boshqaruv paneli' };
export const dynamic = 'force-dynamic';

const GRADE_TONE = {
  "A'lo": 'ok',
  Yaxshi: 'ok',
  Qoniqarli: 'warn',
  Past: 'bad',
  Qoniqarsiz: 'bad',
} as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ davr?: string }>;
}) {
  const session = await requireSession();
  const { davr } = await searchParams;
  const period = davr ?? periodOf();

  const [cards, summary, zones, owners, channels, auditCoverage, overdue, baseline, goals, zoneMeta] =
    await Promise.all([
      scorecards(period),
      summarise({ period }),
      byZone(period),
      byOwner(period),
      byChannel(period),
      coverage(period),
      overdueTickets(8),
      db.baselineMonth.findMany({ orderBy: { period: 'asc' } }),
      db.goal.findMany({ orderBy: { id: 'asc' } }),
      db.zone.findMany({ select: { code: true, name: true }, orderBy: { code: 'asc' } }),
    ]);

  const zoneName = new Map(zoneMeta.map((z) => [z.code, z.name]));
  const slaRate = summary.slaDecided > 0 ? summary.slaMet / summary.slaDecided : null;
  const proactiveShare = summary.total > 0 ? summary.proactive / summary.total : null;
  const repeatShare = summary.total > 0 ? summary.repeat / summary.total : null;

  const trend = baseline.slice(-8).map((b) => ({ label: b.label.split(' ')[0]!, value: b.cases, tone: 'brand' as const }));
  const baselineAvg102 = baseline.filter((b) => b.system102Cases).map((b) => b.system102Cases!);
  const avg102 = baselineAvg102.length > 0 ? baselineAvg102.reduce((a, b) => a + b, 0) / baselineAvg102.length : undefined;

  return (
    <>
      <PageHead
        eyebrow={`iPOST · Sifat nazorati bo'limi · ${periodLabel(period)}`}
        title="Bo'lim holati bir sahifada"
        lede="Barcha raqamlar kunlik reyestr, audit va tizimli yechimlardan avtomatik yig'iladi. Qo'lda kiritilgan har bir tuzatish izohi bilan ko'rinadi."
        actions={
          <>
            <Badge tone={cards.period.status === 'APPROVED' ? 'ok' : cards.period.status === 'SUBMITTED' ? 'warn' : 'neutral'}>
              {PERIOD_STATUS_LABEL[cards.period.status]}
            </Badge>
            <Link href={`/kpi?davr=${period}`} className="btn-ghost">
              KPI hisobi
            </Link>
            {/* CEO va kuzatuvchi ma'lumot kiritmaydi — tugma ham ko'rsatilmaydi */}
            {canWrite(session.role) ? (
              <Link href="/reyestr/yangi" className="btn-primary">
                Murojaat qo'shish
              </Link>
            ) : null}
          </>
        }
      />

      {summary.total === 0 ? (
        <Callout tone="warn" title="Bu davrda reyestr bo'sh">
          KPI ko'rsatkichlari kunlik reyestrdan hisoblanadi. Murojaatlar kiritilmaguncha ballar 0 bo'lib turadi —
          bu xodimning ishlamagani emas, ma'lumot yo'qligini bildiradi.{' '}
          {canWrite(session.role) ? (
            <Link href="/reyestr/yangi" className="font-semibold text-brand">
              Birinchi murojaatni kiriting →
            </Link>
          ) : null}
        </Callout>
      ) : null}

      {/* ── Asosiy ko'rsatkichlar ─────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Jami murojaat"
          value={number(summary.total)}
          hint={`${number(summary.closed)} yopilgan · ${number(summary.open)} ochiq`}
        />
        <StatTile
          label="SLA bajarilishi"
          value={percent(slaRate)}
          target="≥ 90%"
          tone={slaRate === null ? 'neutral' : slaRate >= 0.9 ? 'ok' : slaRate >= 0.75 ? 'warn' : 'bad'}
          hint={`${number(summary.breached)} ta muddat buzilgan`}
        />
        <StatTile
          label="Proaktiv ishlar ulushi"
          value={percent(proactiveShare)}
          target="3 oyda ≥ 10%"
          tone={proactiveShare === null ? 'neutral' : proactiveShare >= 0.1 ? 'ok' : 'bad'}
          hint="Bo'limning haqiqiy vazifasi"
        />
        <StatTile
          label="Takroriy muammolar"
          value={percent(repeatShare)}
          target="≤ 15%"
          tone={repeatShare === null ? 'neutral' : repeatShare <= 0.15 ? 'ok' : 'bad'}
          hint={`${number(summary.repeat)} ta qayta murojaat`}
        />
      </div>

      {/* ── KPI natijalari ────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="Xodimlar KPI natijasi"
          note={`Bo'lim o'rtachasi ${score(cards.departmentAverage)} ball · kirish chegarasi ${number(cards.period.settings.threshold)} · yuqori chegara ${number(cards.period.settings.cap * 100)}%`}
          right={
            <Link href={`/kpi?davr=${period}`} className="text-[12.5px] font-semibold text-brand">
              Batafsil →
            </Link>
          }
        />

        {cards.employees.length === 0 ? (
          <Empty>KPI pasporti hali sozlanmagan.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.employees.map((e) => (
              <div key={e.userId} className="rounded-xl border border-line bg-raised p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{e.shortName}</p>
                    <p className="truncate text-[11px] text-muted">{e.position}</p>
                  </div>
                  <Badge tone={GRADE_TONE[e.card.grade]}>{e.card.grade}</Badge>
                </div>

                <div className="flex justify-center py-1">
                  <ScoreGauge score={e.card.totalScore} threshold={cards.period.settings.threshold} size={150} />
                </div>

                {e.card.missingFacts > 0 ? (
                  <p className="mt-1 text-center text-[11px] font-medium text-warn">
                    {e.card.missingFacts} ko'rsatkichda fakt yo'q
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* ── Kechikkan murojaatlar ──────────────────────────────────────── */}
        <Card>
          <CardHead
            title="Darhol chora talab qiladi"
            note="Ochiq, lekin SLA muddati o'tgan murojaatlar"
            right={
              <Link href="/reyestr?holat=OPEN" className="text-[12.5px] font-semibold text-brand">
                Reyestr →
              </Link>
            }
          />
          {overdue.length === 0 ? (
            <Empty>Muddati o'tgan ochiq murojaat yo'q.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className="th">Murojaat</th>
                  <th className="th">Mas'ul</th>
                  <th className="th">Ustuvorlik</th>
                  <th className="th">Qabul</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((t) => (
                  <tr key={t.id}>
                    <td className="td">
                      <Link href={`/reyestr/${t.id}`} className="font-semibold text-brand">
                        {t.ref}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-[11.5px] text-muted">{t.description}</p>
                    </td>
                    <td className="td whitespace-nowrap text-[12.5px]">{t.owner.shortName}</td>
                    <td className="td">
                      <Badge tone={t.priority === 'CRITICAL' ? 'bad' : t.priority === 'HIGH' ? 'warn' : 'neutral'}>
                        {PRIORITY_LABEL[t.priority]}
                      </Badge>
                    </td>
                    <td className="td tnum whitespace-nowrap text-[12px] text-ink2">{date(t.receivedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* ── Zonalar va xodimlar yuklamasi ──────────────────────────────── */}
        <Card>
          <CardHead title="Yuklama taqsimoti" note="Zona va xodim kesimida murojaat soni" />
          {zones.length === 0 ? (
            <Empty>Ma'lumot yo'q.</Empty>
          ) : (
            <div className="space-y-5">
              <BarList
                data={zones.map((z) => ({
                  label: `${z.zoneCode} — ${zoneName.get(z.zoneCode) ?? ''}`,
                  value: z.count,
                  tone: 'brand',
                }))}
              />
              <div>
                <p className="eyebrow mb-2">Sarflangan vaqt, xodim kesimida</p>
                <BarList
                  data={owners.map((o) => ({ label: o.shortName, value: o.spentHours, tone: 'accent' }))}
                  valueFormat={(v) => hours(v)}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* ── Audit qamrovi ──────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHead
            title="Rejali audit qamrovi"
            note="Shikoyat kelgan joyni emas, tizimni tekshirish — proaktiv ishning o'zagi"
            right={
              <Link href="/audit" className="text-[12.5px] font-semibold text-brand">
                Auditlar →
              </Link>
            }
          />
          <div className="space-y-4">
            {auditCoverage.map((c) => {
              const ratio = c.plan > 0 ? c.count / c.plan : 0;
              return (
                <div key={c.kind}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] text-ink2">{CHECKLIST_LABEL[c.kind]}</span>
                    <span className="tnum text-[12.5px] font-semibold">
                      {number(c.count)} / {number(c.plan)}
                      {c.avgPercent !== null ? (
                        <span className="ml-2 font-normal text-muted">o'rtacha {percent(c.avgPercent, 0)}</span>
                      ) : null}
                    </span>
                  </div>
                  <ProgressBar value={ratio} tone={ratio >= 0.9 ? 'ok' : ratio >= 0.5 ? 'warn' : 'bad'} />
                  {c.failing > 0 ? (
                    <p className="mt-1 text-[11.5px] font-medium text-bad">
                      {c.failing} ta ob'ekt 60% dan past — rahbariyatga eskalatsiya
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Kanallar ───────────────────────────────────────────────────── */}
        <Card>
          <CardHead title="Kanallar" note="Har bir kanal o'lchanadimi" />
          {channels.length === 0 ? (
            <Empty>Ma'lumot yo'q.</Empty>
          ) : (
            <BarList
              data={channels.slice(0, 7).map((c) => ({ label: c.channel, value: c.count, tone: 'brand' }))}
            />
          )}
          {summary.total > 0 ? (
            <div className="mt-5">
              <p className="eyebrow mb-2">Ish turi</p>
              <SplitBar
                parts={[
                  { label: 'Proaktiv', value: summary.proactive, tone: 'ok' },
                  { label: 'Reaktiv', value: summary.reactive, tone: 'muted' },
                ]}
              />
            </div>
          ) : null}
        </Card>
      </div>

      {/* ── Tarixiy oqim ──────────────────────────────────────────────────── */}
      {trend.length > 1 ? (
        <Card className="mt-4">
          <CardHead
            title="Telegram oqimi — o'lchangan baseline"
            note="Tizim joriy etilishidan oldingi haqiqiy hajm (trek bo'yicha dedublikatsiya qilingan). Punktir chiziq — 102 tizimining oylik o'rtachasi."
          />
          <ColumnChart data={trend} reference={avg102} referenceLabel={avg102 ? `102 — oyiga o'rtacha ${number(Math.round(avg102))}` : undefined} />
        </Card>
      ) : null}

      {/* ── 6 oylik maqsadlar ─────────────────────────────────────────────── */}
      {goals.length > 0 ? (
        <Card className="mt-4">
          <CardHead title="6 oylik maqsadlar" note="Rahbariyat bilan kelishilgan yo'l xaritasi" />
          <Table>
            <thead>
              <tr>
                <th className="th">Ko'rsatkich</th>
                <th className="th">Hozir</th>
                <th className="th">3 oyda</th>
                <th className="th">6 oyda</th>
                <th className="th">O'lchash manbasi</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.id}>
                  <td className="td font-medium">{g.metric}</td>
                  <td className="td tnum text-ink2">{g.current}</td>
                  <td className="td tnum">{g.inThree}</td>
                  <td className="td tnum font-semibold">{g.inSix}</td>
                  <td className="td text-[12px] text-muted">{g.dataSource}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {session.role === 'CEO' ? (
        <Callout tone="brand" title="Rahbariyat uchun" >
          Bu panel faqat kuzatish uchun. KPI davrini tasdiqlash{' '}
          <Link href={`/kpi?davr=${period}`} className="font-semibold text-brand">
            KPI hisobi
          </Link>{' '}
          sahifasida — tasdiqlangandan keyin faktlar muzlatiladi va o'zgartirilmaydi.
        </Callout>
      ) : null}
    </>
  );
}

import Link from 'next/link';

import { SplitBar } from '@/components/charts';
import { Badge, Card, CardHead, Empty, PageHead, Table } from '@/components/ui';
import { canSeeSalary, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { date, hours, money, number, percent, score } from '@/lib/format';
import { lastPeriods, periodLabel, periodOf } from '@/lib/period';
import { coverage } from '@/server/audits';
import { scorecards } from '@/server/kpi';
import { byChannel, byOwner, byZone, summarise, topRootCauses } from '@/server/registry';
import { ACTION_STATUS_LABEL, CHECKLIST_LABEL, PERIOD_STATUS_LABEL } from '@/server/shared';

export const metadata = { title: 'Oylik hisobot' };
export const dynamic = 'force-dynamic';

/**
 * Oylik hisobot — Excel'dagi 'Oylik hisobot' varag'ining o'rnini bosadi,
 * lekin qo'lda to'ldirish kerak emas: hammasi reyestrdan yig'iladi.
 * Chop etishga moslashtirilgan (rahbariyatga taqdim etish uchun).
 */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ davr?: string }> }) {
  const session = await requireSession();
  const { davr } = await searchParams;
  const period = davr ?? periodOf();

  const [cards, summary, zones, owners, channels, causes, cov, actions, zoneMeta] = await Promise.all([
    scorecards(period),
    summarise({ period }),
    byZone(period),
    byOwner(period),
    byChannel(period),
    topRootCauses(period),
    coverage(period),
    db.rootCauseAction.findMany({ where: { period }, orderBy: { repeatCount: 'desc' } }),
    db.zone.findMany({ orderBy: { code: 'asc' }, select: { code: true, name: true } }),
  ]);

  const zoneName = new Map(zoneMeta.map((z) => [z.code, z.name]));
  const slaRate = summary.slaDecided > 0 ? summary.slaMet / summary.slaDecided : null;
  const proactiveShare = summary.total > 0 ? summary.proactive / summary.total : null;
  const repeatShare = summary.total > 0 ? summary.repeat / summary.total : null;
  const showMoney = canSeeSalary(session.role);

  const hoursList = owners.map((o) => o.spentHours).filter((h) => h > 0);
  const loadBalance =
    hoursList.length >= 2 ? Math.max(...hoursList) / Math.min(...hoursList) : null;

  const targets: Array<{ label: string; fact: string; target: string; met: boolean | null }> = [
    {
      label: "O'rtacha yopish vaqti",
      fact: hours(summary.avgCloseHours),
      target: '≤ 12 soat',
      met: summary.avgCloseHours === null ? null : summary.avgCloseHours <= 12,
    },
    {
      label: 'SLA bajarilish darajasi',
      fact: percent(slaRate),
      target: '≥ 90%',
      met: slaRate === null ? null : slaRate >= 0.9,
    },
    {
      label: 'Takroriy muammolar ulushi',
      fact: percent(repeatShare),
      target: '≤ 15%',
      met: repeatShare === null ? null : repeatShare <= 0.15,
    },
    {
      label: 'Proaktiv (asosiy) ishlar ulushi',
      fact: percent(proactiveShare),
      target: '≥ 10%',
      met: proactiveShare === null ? null : proactiveShare >= 0.1,
    },
    {
      label: 'Yuklama muvozanati (maks/min)',
      fact: loadBalance === null ? '—' : number(loadBalance, 2),
      target: '≤ 1,30',
      met: loadBalance === null ? null : loadBalance <= 1.3,
    },
  ];

  return (
    <>
      <PageHead
        eyebrow={`Oylik hisobot · ${periodLabel(period)}`}
        title="Bo'lim faoliyati yakuni"
        lede="Barcha raqamlar kunlik reyestr, audit va tizimli yechimlardan avtomatik yig'ilgan. Hisobot har oyning 5-sanasigacha rahbariyatga taqdim etiladi."
        actions={
          <>
            <form method="get" className="flex items-center gap-2">
              <select name="davr" defaultValue={period} className="field !py-1.5 !text-[12.5px]">
                {lastPeriods(8)
                  .reverse()
                  .map((v) => (
                    <option key={v} value={v}>
                      {periodLabel(v)}
                    </option>
                  ))}
              </select>
              <button type="submit" className="btn-ghost">
                Ko'rish
              </button>
            </form>
            <Badge tone={cards.period.status === 'APPROVED' ? 'ok' : 'neutral'}>
              {PERIOD_STATUS_LABEL[cards.period.status]}
            </Badge>
          </>
        }
      />

      {/* ── 1. Umumiy ko'rsatkichlar ──────────────────────────────────────── */}
      <Card>
        <CardHead title="1. Umumiy ko'rsatkichlar" note={`${number(cards.period.workingDays)} ish kuni`} />
        <Table>
          <thead>
            <tr>
              <th className="th">Ko'rsatkich</th>
              <th className="th text-right">Fakt</th>
              <th className="th">Maqsad</th>
              <th className="th">Holat</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="td font-medium">Jami murojaat</td>
              <td className="td tnum text-right font-semibold">{number(summary.total)}</td>
              <td className="td text-muted">—</td>
              <td className="td text-muted">—</td>
            </tr>
            {targets.map((t) => (
              <tr key={t.label}>
                <td className="td font-medium">{t.label}</td>
                <td className="td tnum text-right font-semibold">{t.fact}</td>
                <td className="td text-[12.5px]">{t.target}</td>
                <td className="td">
                  {t.met === null ? (
                    <span className="text-[12px] text-muted">ma'lumot yo'q</span>
                  ) : (
                    <Badge tone={t.met ? 'ok' : 'bad'}>{t.met ? '✔ Bajarildi' : '✘ Bajarilmadi'}</Badge>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td className="td font-medium">Kritik ustuvorlikdagi murojaatlar</td>
              <td className="td tnum text-right font-semibold">{number(summary.critical)}</td>
              <td className="td text-muted">—</td>
              <td className="td text-muted">—</td>
            </tr>
            <tr>
              <td className="td font-medium">Jami sarflangan vaqt</td>
              <td className="td tnum text-right font-semibold">{hours(summary.spentHours, 0)}</td>
              <td className="td text-muted">—</td>
              <td className="td text-muted">—</td>
            </tr>
          </tbody>
        </Table>

        {summary.total > 0 ? (
          <div className="mt-5">
            <p className="eyebrow mb-2">Ish turi taqsimoti</p>
            <SplitBar
              parts={[
                { label: 'Proaktiv', value: summary.proactive, tone: 'ok' },
                { label: 'Reaktiv', value: summary.reactive, tone: 'muted' },
              ]}
            />
          </div>
        ) : null}
      </Card>

      {/* ── 2. Zonalar ────────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead title="2. Zonalar bo'yicha" />
        {zones.length === 0 ? (
          <Empty>Ma'lumot yo'q.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Zona</th>
                <th className="th text-right">Murojaat</th>
                <th className="th text-right">Ulushi</th>
                <th className="th text-right">Sarflangan soat</th>
                <th className="th text-right">O'rtacha soat/murojaat</th>
                <th className="th text-right">SLA bajarildi</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.zoneCode}>
                  <td className="td font-medium">
                    {z.zoneCode} — {zoneName.get(z.zoneCode) ?? ''}
                  </td>
                  <td className="td tnum text-right">{number(z.count)}</td>
                  <td className="td tnum text-right">{percent(summary.total > 0 ? z.count / summary.total : null, 0)}</td>
                  <td className="td tnum text-right">{hours(z.spentHours)}</td>
                  <td className="td tnum text-right">{hours(z.count > 0 ? z.spentHours / z.count : null, 2)}</td>
                  <td className="td tnum text-right">{percent(z.count > 0 ? z.slaMet / z.count : null, 0)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ── 3. Xodimlar yuklamasi va KPI ──────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="3. Xodimlar bo'yicha yuklama va natija"
          note={
            loadBalance !== null
              ? `Yuklama muvozanati ${number(loadBalance, 2)} (maqsad ≤ 1,30)`
              : 'Yuklama muvozanati uchun kamida ikki xodimda vaqt qayd etilishi kerak'
          }
        />
        <Table>
          <thead>
            <tr>
              <th className="th">Xodim</th>
              <th className="th text-right">Murojaat</th>
              <th className="th text-right">Sarflangan soat</th>
              <th className="th text-right">KPI ball</th>
              <th className="th">Baho</th>
              {showMoney ? <th className="th text-right">Bonus</th> : null}
            </tr>
          </thead>
          <tbody>
            {cards.employees.map((e) => {
              const load = owners.find((o) => o.key === e.key);
              return (
                <tr key={e.userId}>
                  <td className="td font-medium">{e.shortName}</td>
                  <td className="td tnum text-right">{number(load?.count ?? 0)}</td>
                  <td className="td tnum text-right">{hours(load?.spentHours ?? 0)}</td>
                  <td className="td tnum text-right font-semibold">{score(e.card.totalScore)}</td>
                  <td className="td">
                    <Badge
                      tone={
                        e.card.grade === "A'lo" || e.card.grade === 'Yaxshi'
                          ? 'ok'
                          : e.card.grade === 'Qoniqarli'
                            ? 'warn'
                            : 'bad'
                      }
                    >
                      {e.card.grade}
                    </Badge>
                  </td>
                  {showMoney ? (
                    <td className="td tnum text-right">{e.card.bonus > 0 ? money(e.card.bonus) : '—'}</td>
                  ) : null}
                </tr>
              );
            })}
            <tr>
              <td className="td font-semibold">Bo'lim o'rtachasi</td>
              <td className="td tnum text-right font-semibold">{number(summary.total)}</td>
              <td className="td tnum text-right font-semibold">{hours(summary.spentHours, 0)}</td>
              <td className="td tnum text-right font-semibold">{score(cards.departmentAverage)}</td>
              <td className="td" />
              {showMoney ? <td className="td tnum text-right font-semibold">{money(cards.bonusTotal)}</td> : null}
            </tr>
          </tbody>
        </Table>
      </Card>

      {/* ── 4. Kanallar va audit qamrovi ──────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="4. Kanallar kesimi" note="Har bir kanal hisobotda ko'rinishi shart" />
          {channels.length === 0 ? (
            <Empty>Ma'lumot yo'q.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className="th">Kanal</th>
                  <th className="th text-right">Murojaat</th>
                  <th className="th text-right">Ulushi</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.channel}>
                    <td className="td">{c.channel}</td>
                    <td className="td tnum text-right">{number(c.count)}</td>
                    <td className="td tnum text-right">{percent(summary.total > 0 ? c.count / summary.total : null, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHead title="5. Audit qamrovi" note="Rejali tekshiruvlar bajarilishi" />
          <Table>
            <thead>
              <tr>
                <th className="th">Checklist</th>
                <th className="th text-right">Bajarildi</th>
                <th className="th text-right">Reja</th>
                <th className="th text-right">O'rtacha</th>
              </tr>
            </thead>
            <tbody>
              {cov.map((c) => (
                <tr key={c.kind}>
                  <td className="td">{CHECKLIST_LABEL[c.kind]}</td>
                  <td className="td tnum text-right font-semibold">{number(c.count)}</td>
                  <td className="td tnum text-right text-muted">{number(c.plan)}</td>
                  <td className="td tnum text-right">{percent(c.avgPercent, 0)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* ── 6. Takrorlanadigan sabablar ───────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="6. Takrorlanadigan sabablar (TOP-10)"
          note="Root-cause tahlili — takrorlanishni to'xtatish uchun asos"
          right={
            <Link href="/yechimlar" className="text-[12.5px] font-semibold text-brand">
              Tizimli yechimlar →
            </Link>
          }
        />
        {causes.length === 0 ? (
          <Empty>Sabablar hali yozilmagan — murojaatlarni yopishda "root cause" maydonini to'ldiring.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th w-10">№</th>
                <th className="th">Sabab</th>
                <th className="th text-right">Takrorlanish</th>
              </tr>
            </thead>
            <tbody>
              {causes.map((c, i) => (
                <tr key={c.rootCause}>
                  <td className="td tnum text-muted">{i + 1}</td>
                  <td className="td">{c.rootCause}</td>
                  <td className="td tnum text-right font-semibold">{number(c.count)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ── 7. Tizimli yechimlar ──────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead title="7. Tizimli yechimlar va choralar" note="Natijasi tasdiqlangan yechimlar KPI'ga kiradi" />
        {actions.length === 0 ? (
          <Empty>Bu davrda tizimli yechim kiritilmagan.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Muammo</th>
                <th className="th">Sabab</th>
                <th className="th">Yechim</th>
                <th className="th">Mas'ul bo'lim</th>
                <th className="th">Muddat</th>
                <th className="th">Holat</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="td font-medium">{a.title}</td>
                  <td className="td text-[12px] text-ink2">{a.rootCause}</td>
                  <td className="td text-[12px]">{a.solution}</td>
                  <td className="td text-[12px]">{a.responsibleDept}</td>
                  <td className="td tnum whitespace-nowrap text-[12px]">{date(a.dueDate)}</td>
                  <td className="td">
                    <Badge tone={a.status === 'VERIFIED' ? 'ok' : a.status === 'CANCELLED' ? 'bad' : 'neutral'}>
                      {ACTION_STATUS_LABEL[a.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-6 text-center text-[11.5px] text-muted">
        Hisobot {periodLabel(period)} uchun avtomatik shakllantirildi · manba: kunlik reyestr, checklist auditlari,
        tizimli yechimlar reyestri
      </p>
    </>
  );
}

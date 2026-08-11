import Link from 'next/link';

import { ScoreGauge } from '@/components/charts';
import { Badge, Callout, Card, CardHead, Empty, PageHead, ProgressBar, Table } from '@/components/ui';
import { canApprovePeriod, canOverrideKpi, canSeeSalary, requireSession } from '@/lib/auth';
import { byUnit, dateTime, money, number, percent, score } from '@/lib/format';
import { gradeBadge } from '@/lib/grade';
import { lastPeriods, periodLabel, periodOf } from '@/lib/period';
import { scorecards } from '@/server/kpi';
import { PERIOD_STATUS_LABEL } from '@/server/shared';

import { FactEditor } from './fact-row';
import { PeriodSettingsForm, RecalcButton, StatusButton } from './workflow';

export const metadata = { title: 'KPI hisobi' };
export const dynamic = 'force-dynamic';

export default async function KpiPage({ searchParams }: { searchParams: Promise<{ davr?: string }> }) {
  const session = await requireSession();
  const { davr } = await searchParams;
  const period = davr ?? periodOf();

  const data = await scorecards(period);
  const p = data.period;
  const locked = p.status === 'APPROVED';
  const canEdit = canOverrideKpi(session.role) && !locked;
  const showMoney = canSeeSalary(session.role);

  // Mutaxassis faqat o'z kartasini ko'radi
  const visible =
    session.role === 'SPECIALIST' ? data.employees.filter((e) => e.key === session.key) : data.employees;

  const periodOptions = lastPeriods(8).reverse();

  return (
    <>
      <PageHead
        eyebrow={`KPI hisobi · ${p.label}`}
        title="Oylik ball va bonus"
        lede="Faktlar kunlik reyestr, auditlar va tizimli yechimlardan avtomatik olinadi. Ball = og'irlik × min(bajarilish, yuqori chegara)."
        actions={
          <>
            <form method="get" className="flex items-center gap-2">
              <select name="davr" defaultValue={period} className="field !py-1.5 !text-[12.5px]">
                {periodOptions.map((v) => (
                  <option key={v} value={v}>
                    {periodLabel(v)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-ghost">
                Ko'rish
              </button>
            </form>
            {canEdit ? <RecalcButton period={period} /> : null}
          </>
        }
      />

      {/* ── Davr holati va tasdiqlash oqimi ──────────────────────────────── */}
      <Card>
        <CardHead
          title="Davr holati"
          note={`Ish kunlari ${number(p.workingDays)} · bonus maoshning ${percent(p.settings.bonusShare, 0)} qismi · kirish chegarasi ${number(p.settings.threshold)} ball · yuqori chegara ${percent(p.settings.cap, 0)}`}
          right={
            <Badge
              tone={
                p.status === 'APPROVED' ? 'ok' : p.status === 'REJECTED' ? 'bad' : p.status === 'SUBMITTED' ? 'warn' : 'neutral'
              }
            >
              {PERIOD_STATUS_LABEL[p.status]}
            </Badge>
          }
        />

        <div className="flex flex-wrap items-start gap-3">
          {canOverrideKpi(session.role) && !locked ? (
            <>
              {p.status !== 'TRIAL' ? (
                <StatusButton period={period} status="TRIAL" label="Sinov rejimiga o'tkazish" />
              ) : (
                <StatusButton period={period} status="DRAFT" label="Sinov rejimini o'chirish" />
              )}
              {p.status !== 'SUBMITTED' ? (
                <StatusButton period={period} status="SUBMITTED" label="Rahbariyatga yuborish" variant="primary" />
              ) : null}
            </>
          ) : null}

          {canApprovePeriod(session.role) && !locked ? (
            <>
              <StatusButton period={period} status="APPROVED" label="Tasdiqlash" variant="brand" needsComment />
              <StatusButton period={period} status="REJECTED" label="Qaytarish" variant="danger" needsComment />
            </>
          ) : null}
        </div>

        {p.status === 'TRIAL' ? (
          <Callout tone="warn" title="Sinov rejimi">
            Ball hisoblanadi, lekin bonus to'lanmaydi. Joriy etish rejasining 7-bandi: birinchi ikki oyda bazaviy
            (baseline) qiymatlar to'planadi, shundan keyingina KPI bonusga bog'lanadi.
          </Callout>
        ) : null}

        {p.status === 'REJECTED' && p.ceoComment ? (
          <Callout tone="bad" title="Rahbariyat qaytardi">
            {p.ceoComment}
          </Callout>
        ) : null}

        {locked ? (
          <Callout tone="ok" title="Davr tasdiqlangan">
            {p.approvedByName ? `${p.approvedByName} tomonidan ` : ''}
            {dateTime(p.approvedAt)} da tasdiqlangan. Faktlar muzlatildi — endi o'zgartirilmaydi.
            {p.ceoComment ? ` Izoh: ${p.ceoComment}` : ''}
          </Callout>
        ) : null}
      </Card>

      {/* ── Umumiy natija ────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="Bo'lim bo'yicha yakuniy natija"
          note={`O'rtacha ${score(data.departmentAverage)} ball${showMoney ? ` · jami bonus ${money(data.bonusTotal)}` : ''}`}
        />
        {data.employees.length === 0 ? (
          <Empty>KPI pasporti sozlanmagan — sozlamalar bo'limiga qarang.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Xodim</th>
                <th className="th">Lavozim</th>
                <th className="th text-right">Jami ball</th>
                <th className="th">Baho</th>
                {showMoney ? <th className="th text-right">Maosh</th> : null}
                {showMoney ? <th className="th text-right">Bonus</th> : null}
                <th className="th">Izoh</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e) => {
                const badge = gradeBadge(e.card);
                return (
                <tr key={e.userId}>
                  <td className="td font-semibold">{e.shortName}</td>
                  <td className="td text-[12px] text-ink2">{e.position}</td>
                  <td className="td tnum text-right font-semibold">{score(e.card.totalScore)}</td>
                  <td className="td">
                    {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : <span className="text-muted">—</span>}
                  </td>
                  {showMoney ? <td className="td tnum text-right text-[12.5px]">{money(e.salary)}</td> : null}
                  {showMoney ? (
                    <td className="td tnum text-right font-semibold">
                      {e.card.bonus > 0 ? money(e.card.bonus) : '—'}
                    </td>
                  ) : null}
                  <td className="td text-[11.5px] text-muted">
                    {e.card.hasNoData
                      ? "hali hech narsa o'lchanmagan"
                      : (e.card.bonusBlockedReason ?? (e.card.missingFacts > 0 ? `${e.card.missingFacts} faktsiz` : ''))}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ── Har bir xodimning kartasi ────────────────────────────────────── */}
      {visible.map((e) => (
        <Card key={e.userId} className="mt-4">
          <CardHead
            title={`${e.fullName} — ${e.position}`}
            note={`Og'irliklar yig'indisi ${number(e.card.weightTotal)} ball${e.card.weightTotal !== 100 ? ' ⚠ 100 bo‘lishi kerak' : ''}`}
            right={
              <div className="flex items-center gap-4">
                {showMoney && e.card.bonus > 0 ? (
                  <div className="text-right">
                    <p className="eyebrow">Bonus</p>
                    <p className="tnum text-[15px] font-semibold">{money(e.card.bonus)}</p>
                  </div>
                ) : null}
                <ScoreGauge score={e.card.totalScore} threshold={p.settings.threshold} size={132} />
              </div>
            }
          />

          <Table>
            <thead>
              <tr>
                <th className="th w-8">№</th>
                <th className="th">Ko'rsatkich</th>
                <th className="th text-right">Og'irlik</th>
                <th className="th">Maqsad</th>
                <th className="th text-right">Fakt</th>
                <th className="th text-right">Bajarilish</th>
                <th className="th text-right">Ball</th>
                <th className="th">Manba</th>
              </tr>
            </thead>
            <tbody>
              {e.rows.map((r) => {
                const overridden = r.manualValue !== null;
                return (
                  <tr key={r.indicatorId}>
                    <td className="td tnum text-muted">{r.no}</td>
                    <td className="td">
                      <p className="font-medium">{r.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{r.dataSource}</p>
                    </td>
                    <td className="td tnum text-right">{number(r.weight * 100)}</td>
                    <td className="td whitespace-nowrap text-[12.5px]">{r.targetText}</td>
                    <td className="td tnum text-right">
                      {r.usedValue === null ? (
                        <span className="font-medium text-warn">kiritilmagan</span>
                      ) : (
                        <span className="font-semibold">{byUnit(r.usedValue, r.unit)}</span>
                      )}
                      {overridden ? (
                        <p className="text-[10.5px] text-accent">
                          qo'lda · avto: {byUnit(r.autoValue, r.unit)}
                        </p>
                      ) : null}
                    </td>
                    <td className="td tnum text-right">
                      <span
                        className={
                          r.achievement >= 1 ? 'font-semibold text-ok' : r.achievement >= 0.8 ? 'text-warn' : 'text-bad'
                        }
                      >
                        {percent(r.achievement, 0)}
                      </span>
                      <div className="mt-1 w-[68px] ml-auto">
                        <ProgressBar
                          value={r.achievement / p.settings.cap}
                          height={4}
                          tone={r.achievement >= 1 ? 'ok' : r.achievement >= 0.8 ? 'warn' : 'bad'}
                        />
                      </div>
                    </td>
                    <td className="td tnum text-right font-semibold">
                      {score(r.score)}
                      <span className="ml-1 text-[11px] font-normal text-muted">/ {number(r.maxScore)}</span>
                    </td>
                    <td className="td w-[190px]">
                      <Badge tone={r.metricSource === 'AUTO' ? 'brand' : 'neutral'}>
                        {r.metricSource === 'AUTO' ? 'Avtomatik' : "Qo'lda"}
                      </Badge>
                      {canEdit ? (
                        <div className="mt-1.5">
                          <FactEditor period={period} row={r} locked={false} />
                        </div>
                      ) : r.comment ? (
                        <p className="mt-1 text-[11px] text-muted">
                          {r.overriddenBy ? `${r.overriddenBy}: ` : ''}
                          {r.comment}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="td" />
                <td className="td font-semibold">JAMI</td>
                <td className="td tnum text-right font-semibold">{number(e.card.weightTotal)}</td>
                <td className="td" colSpan={3} />
                <td className="td tnum text-right text-[14px] font-semibold">{score(e.card.totalScore)}</td>
                <td className="td">
                  {(() => {
                    const badge = gradeBadge(e.card);
                    return badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : <span className="text-muted">—</span>;
                  })()}
                </td>
              </tr>
            </tfoot>
          </Table>
        </Card>
      ))}

      {/* ── Davr sozlamalari ─────────────────────────────────────────────── */}
      {canEdit ? (
        <Card className="mt-4">
          <CardHead
            title="Davr sozlamalari"
            note="O'zgartirilgandan keyin ballar avtomatik qayta hisoblanadi"
          />
          <PeriodSettingsForm
            period={period}
            bonusShare={p.settings.bonusShare}
            threshold={p.settings.threshold}
            cap={p.settings.cap}
            workingDays={p.workingDays}
            note={p.note}
          />
        </Card>
      ) : null}

      <Callout tone="neutral" title="Nima uchun bunday hisoblanadi">
        Bajarilish — "Yuqori yaxshi" ko'rsatkichlarda fakt/maqsad, "Past yaxshi" larda maqsad/fakt. Ball og'irlikka
        ko'paytiriladi va yuqori chegara ({percent(p.settings.cap, 0)}) bilan kesiladi, ya'ni bitta ko'rsatkichdagi
        favqulodda natija boshqa kamchilikni yopib ketmaydi. Jami ball {number(p.settings.threshold)} dan past bo'lsa
        bonus to'lanmaydi.{' '}
        <Link href="/taqsimot" className="font-semibold text-brand">
          Ko'rsatkichlar pasporti →
        </Link>
      </Callout>
    </>
  );
}

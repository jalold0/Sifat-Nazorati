import { Badge, Callout, Card, CardHead, Empty, PageHead, ProgressBar, Table } from '@/components/ui';
import { canWrite, requireSession } from '@/lib/auth';
import { date, dateInputValue, number, percent } from '@/lib/format';
import { lastPeriods, periodLabel, periodOf } from '@/lib/period';
import { coverage, listAudits, listTemplatesWithItems, worstObjects } from '@/server/audits';
import { CHECKLIST_LABEL } from '@/server/shared';

import { AuditForm, type TemplateOption } from './audit-form';

export const metadata = { title: 'Checklist auditlari' };
export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ davr?: string }> }) {
  const session = await requireSession();
  const { davr } = await searchParams;
  const period = davr ?? periodOf();

  const [templates, cov, audits, worst] = await Promise.all([
    listTemplatesWithItems(),
    coverage(period),
    listAudits({ period }, 60),
    worstObjects(period),
  ]);

  const withItems: TemplateOption[] = templates.map((t) => ({
    kind: t.kind,
    title: t.title,
    note: t.note,
    items: t.items.map((i) => ({
      id: i.id,
      no: i.no,
      title: i.title,
      requirement: i.requirement,
      max: i.max,
    })),
  }));

  return (
    <>
      <PageHead
        eyebrow={`Checklist auditlari · ${periodLabel(period)}`}
        title="Rejali tekshiruvlar"
        lede="Shikoyat kelgan joyni emas, tizimni tekshirish. Audit soni va sifati to'g'ridan-to'g'ri KPI'ga kiradi."
        actions={
          <form method="get" className="flex items-center gap-2">
            <select name="davr" defaultValue={period} className="field !py-1.5 !text-meta">
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
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {cov.map((c) => {
          const ratio = c.plan > 0 ? c.count / c.plan : 0;
          return (
            <Card key={c.kind}>
              <p className="text-meta font-medium text-ink2">{CHECKLIST_LABEL[c.kind]}</p>
              <p className="tnum mt-1 text-stat leading-none">
                {number(c.count)}
                <span className="ml-1 text-body font-medium text-muted">/ {number(c.plan)} reja</span>
              </p>
              <div className="mt-3">
                <ProgressBar value={ratio} tone={ratio >= 0.9 ? 'ok' : ratio >= 0.5 ? 'warn' : 'bad'} />
              </div>
              <p className="mt-2 text-micro text-muted">
                O'rtacha natija {percent(c.avgPercent, 0)}
                {c.failing > 0 ? ` · ${c.failing} ta eskalatsiya` : ''}
              </p>
            </Card>
          );
        })}
      </div>

      {worst.length > 0 ? (
        <Card className="mt-section">
          <CardHead
            title="Qayta tekshiruv talab qiladi"
            note="75% dan past natija olgan ob'ektlar — 7 kun ichida qaytadan ko'riladi"
          />
          <Table>
            <thead>
              <tr>
                <th className="th">Ob'ekt</th>
                <th className="th">Tur</th>
                <th className="th">Sana</th>
                <th className="th text-right">Natija</th>
                <th className="th">Xulosa</th>
              </tr>
            </thead>
            <tbody>
              {worst.map((a) => (
                <tr key={a.id}>
                  <td className="td font-medium">{a.objectName}</td>
                  <td className="td text-meta text-ink2">{CHECKLIST_LABEL[a.kind]}</td>
                  <td className="td tnum whitespace-nowrap text-meta">{date(a.auditedAt)}</td>
                  <td className="td tnum text-right font-semibold">{percent(Number(a.percent), 0)}</td>
                  <td className="td">
                    <Badge tone={Number(a.percent) < 0.6 ? 'bad' : 'warn'}>{a.verdict}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {canWrite(session.role) ? (
        <Card className="mt-section">
          <CardHead
            title="Yangi audit"
            note="Baholash: 2 — to'liq bajarilgan · 1 — qisman · 0 — bajarilmagan. Har bir 0 va 1 ga dalil majburiy."
          />
          <AuditForm templates={withItems} today={dateInputValue(new Date())} />
        </Card>
      ) : (
        <Callout tone="neutral">Audit kiritish bo'lim xodimlari huquqida. Siz natijalarni ko'rasiz.</Callout>
      )}

      <Card className="mt-section">
        <CardHead title="Davr auditlari" note={`${number(audits.length)} ta tekshiruv`} />
        {audits.length === 0 ? (
          <Empty>Bu davrda audit o'tkazilmagan.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Sana</th>
                <th className="th">Ob'ekt</th>
                <th className="th">Tur</th>
                <th className="th">Tekshiruvchi</th>
                <th className="th text-right">Ball</th>
                <th className="th text-right">Natija</th>
                <th className="th">Xulosa</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id}>
                  <td className="td tnum whitespace-nowrap text-meta">{date(a.auditedAt)}</td>
                  <td className="td font-medium">
                    {a.objectName}
                    {a.objectCode ? <span className="ml-1 text-micro text-muted">{a.objectCode}</span> : null}
                    {a.externalRef ? <p className="text-micro text-muted">{a.externalRef}</p> : null}
                  </td>
                  <td className="td text-meta text-ink2">{CHECKLIST_LABEL[a.kind]}</td>
                  <td className="td text-meta">{a.auditor.shortName}</td>
                  <td className="td tnum text-right">
                    {a.totalScore} / {a.maxScore}
                  </td>
                  <td className="td tnum text-right font-semibold">{percent(Number(a.percent), 0)}</td>
                  <td className="td">
                    <Badge
                      tone={
                        Number(a.percent) >= 0.9
                          ? 'ok'
                          : Number(a.percent) >= 0.75
                            ? 'warn'
                            : 'bad'
                      }
                    >
                      {a.verdict}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

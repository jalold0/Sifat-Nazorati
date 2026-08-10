import { Badge, Callout, Card, CardHead, Empty, PageHead, StatTile, Table } from '@/components/ui';
import { canWrite, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { date, dateInputValue, number } from '@/lib/format';
import { lastPeriods, periodLabel, periodOf } from '@/lib/period';
import { topRootCauses } from '@/server/registry';
import { ACTION_STATUS_LABEL } from '@/server/shared';

import { SolutionForm, StatusForm } from './forms';

export const metadata = { title: 'Tizimli yechimlar' };
export const dynamic = 'force-dynamic';

export default async function SolutionsPage({ searchParams }: { searchParams: Promise<{ davr?: string }> }) {
  const session = await requireSession();
  const { davr } = await searchParams;
  const period = davr ?? periodOf();

  const [actions, causes, verified] = await Promise.all([
    db.rootCauseAction.findMany({
      where: { period },
      orderBy: [{ status: 'asc' }, { repeatCount: 'desc' }],
      include: { createdBy: { select: { shortName: true } } },
    }),
    topRootCauses(period, 10),
    db.rootCauseAction.count({ where: { period, status: 'VERIFIED' } }),
  ]);

  const overdue = actions.filter(
    (a) => a.dueDate && a.dueDate < new Date() && a.status !== 'VERIFIED' && a.status !== 'CANCELLED',
  ).length;

  return (
    <>
      <PageHead
        eyebrow={`Tizimli yechimlar · ${periodLabel(period)}`}
        title="Takrorlanishni to'xtatish"
        lede="Murojaatni yopish — ish emas, natija. Haqiqiy natija muammo qaytmasligi. Faqat natijasi tasdiqlangan yechimlar KPI'ga kiradi."
        actions={
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
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Jami yechim" value={number(actions.length)} />
        <StatTile
          label="Natijasi tasdiqlangan"
          value={number(verified)}
          target="≥ 2 ta / oy"
          tone={verified >= 2 ? 'ok' : 'bad'}
          hint="Bo'lim boshlig'i KPI №18"
        />
        <StatTile label="Bajarilmoqda" value={number(actions.filter((a) => a.status === 'IN_PROGRESS').length)} />
        <StatTile label="Muddati o'tgan" value={number(overdue)} tone={overdue > 0 ? 'warn' : 'neutral'} />
      </div>

      {causes.length > 0 ? (
        <Card className="mt-4">
          <CardHead
            title="Reyestrdan chiqqan takrorlanadigan sabablar"
            note="Bu ro'yxatdagi har bir sabab uchun tizimli yechim bo'lishi kerak"
          />
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
        </Card>
      ) : (
        <Callout tone="neutral" title="Sabablar hali to'planmagan">
          Murojaatlarni yopishda "sabab (root cause)" maydonini to'ldirsangiz, tizim eng ko'p takrorlanadigan
          sabablarni o'zi ajratib beradi.
        </Callout>
      )}

      {canWrite(session.role) ? (
        <Card className="mt-4">
          <CardHead title="Yangi tizimli yechim" note="Sabab → yechim → mas'ul bo'lim → muddat → natija" />
          <SolutionForm period={period} today={dateInputValue(new Date())} />
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHead title="Yechimlar reyestri" />
        {actions.length === 0 ? (
          <Empty>Bu davrda tizimli yechim kiritilmagan.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Muammo</th>
                <th className="th">Sabab → yechim</th>
                <th className="th">Mas'ul</th>
                <th className="th text-right">Takror</th>
                <th className="th">Muddat</th>
                <th className="th">Holat</th>
                {canWrite(session.role) ? <th className="th w-[160px]">Amal</th> : null}
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="td">
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted">{a.problem}</p>
                  </td>
                  <td className="td max-w-[340px]">
                    <p className="text-[12px] text-ink2">{a.rootCause}</p>
                    <p className="mt-1 text-[12px] font-medium">→ {a.solution}</p>
                    {a.effect ? <p className="mt-1 text-[11.5px] text-ok">Natija: {a.effect}</p> : null}
                  </td>
                  <td className="td text-[12px]">{a.responsibleDept}</td>
                  <td className="td tnum text-right">{number(a.repeatCount)}</td>
                  <td className="td tnum whitespace-nowrap text-[12px]">{date(a.dueDate)}</td>
                  <td className="td">
                    <Badge
                      tone={
                        a.status === 'VERIFIED'
                          ? 'ok'
                          : a.status === 'CANCELLED'
                            ? 'bad'
                            : a.status === 'IN_PROGRESS'
                              ? 'warn'
                              : 'neutral'
                      }
                    >
                      {ACTION_STATUS_LABEL[a.status]}
                    </Badge>
                    <p className="mt-1 text-[10.5px] text-muted">{a.createdBy.shortName}</p>
                  </td>
                  {canWrite(session.role) ? (
                    <td className="td">
                      <StatusForm id={a.id} status={a.status} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

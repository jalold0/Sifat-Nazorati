import { Callout, Card, CardHead, Empty, PageHead, Table } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { hours, number, percent } from '@/lib/format';
import { periodLabel, periodOf } from '@/lib/period';
import { computeScenario, listScenarios, measureNorms } from '@/server/capacity';

import { ScenarioForm, type ScenarioDefaults } from './scenario-form';

export const metadata = { title: 'Quvvat hisobi' };
export const dynamic = 'force-dynamic';

export default async function CapacityPage({ searchParams }: { searchParams: Promise<{ davr?: string }> }) {
  await requireSession();
  const { davr } = await searchParams;
  const period = davr ?? periodOf();

  const [scenarios, zones, measured] = await Promise.all([
    listScenarios(),
    db.zone.findMany({ orderBy: { code: 'asc' }, select: { code: true, name: true } }),
    measureNorms(period),
  ]);

  const baseline = scenarios.find((s) => s.isBaseline) ?? scenarios[0];
  const baselineResult = baseline ? await computeScenario(baseline.id) : null;

  const defaults: ScenarioDefaults = {
    name: `Xronometraj — ${periodLabel(period)}`,
    period,
    monthlyVolume: String(baseline?.monthlyVolume ?? 5579),
    workingDays: String(baseline?.workingDays ?? 21),
    hoursPerDay: String(Number(baseline?.hoursPerDay ?? 8)),
    specialists: String(Number(baseline?.specialists ?? 3)),
    utilisationPercent: String(Number(baseline?.utilisation ?? 0.85) * 100),
    proactiveSharePercent: String(Number(baseline?.proactiveShare ?? 0.2) * 100),
    note: '',
    zones: zones
      .filter((z) => z.code !== 'D')
      .map((z) => {
        const existing = baseline?.zones.find((bz) => bz.zoneCode === z.code);
        return {
          zoneCode: z.code,
          name: z.name,
          flowSharePercent: existing ? String(Number(existing.flowShare) * 100) : '',
          minutesPerCase: existing ? String(Number(existing.minutesPerCase)) : '',
        };
      }),
  };

  const measuredMap = {
    minutes: Object.fromEntries(measured.norms.map((n) => [n.zoneCode, n.minutesPerCase])),
    shares: Object.fromEntries(measured.norms.map((n) => [n.zoneCode, n.flowShare])),
    coverage: measured.coverage,
  };

  return (
    <>
      <PageHead
        eyebrow={`Quvvat hisobi · ${periodLabel(period)}`}
        title="Bo'lim real yuklamaga bardosh bera oladimi?"
        lede="Shtat masalasi taxmin bilan hal qilinmaydi. Norma reyestrdagi haqiqiy vaqtdan o'lchanadi, natija esa soatlarda ko'rinadi."
      />

      <Callout tone="warn" title="Eng muhim shart — xronometraj">
        Vaqt normasi o'lchanmasa, na shtat so'rashga, na KPI maqsadlarini asoslashga dalil bo'lmaydi. Hozir bu davrda{' '}
        {number(measured.casesWithTime)} ta murojaatda vaqt qayd etilgan ({percent(measured.coverage, 0)} qamrov,
        jami {number(measured.measuredCases)} ta).
      </Callout>

      {baselineResult ? (
        <Card className="mt-section">
          <CardHead
            title={`Saqlangan hisob — ${baseline?.name}`}
            note={`${baseline?.period} · oylik oqim ${number(baselineResult.inputs.monthlyVolume)} ta`}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cell label="Yuklama darajasi" value={percent(baselineResult.loadFactor, 0)} bad={baselineResult.loadFactor > 1} />
            <Cell label="Taqchillik" value={hours(baselineResult.balanceHours, 0)} bad={baselineResult.balanceHours < 0} />
            <Cell label="Kerakli FTE" value={number(baselineResult.requiredFte, 2)} />
            <Cell
              label="Qo'shimcha shtat"
              value={number(baselineResult.extraStaffNeeded, 2)}
              bad={baselineResult.extraStaffNeeded > 0}
            />
          </div>
        </Card>
      ) : null}

      <Card className="mt-section">
        <CardHead
          title="Kalkulyator"
          note="Qiymatlarni o'zgartirsangiz natija darhol qayta hisoblanadi — rahbariyat bilan suhbatda jonli ko'rsatish mumkin"
        />
        <ScenarioForm defaults={defaults} measured={measuredMap} />
      </Card>

      <Card className="mt-section">
        <CardHead title="Saqlangan sxemalar" note="Turli farazlarni taqqoslash uchun" />
        {scenarios.length === 0 ? (
          <Empty>Hali sxema saqlanmagan.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Nom</th>
                <th className="th">Davr</th>
                <th className="th text-right">Oqim</th>
                <th className="th text-right">Xodim</th>
                <th className="th text-right">Proaktiv</th>
                <th className="th">Izoh</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td className="td font-medium">{s.name}</td>
                  <td className="td text-meta">{periodLabel(s.period)}</td>
                  <td className="td tnum text-right">{number(s.monthlyVolume)}</td>
                  <td className="td tnum text-right">{number(Number(s.specialists), 1)}</td>
                  <td className="td tnum text-right">{percent(Number(s.proactiveShare), 0)}</td>
                  <td className="td text-meta text-muted">{s.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function Cell({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-3.5">
      <p className="text-meta text-ink2">{label}</p>
      <p className={`tnum mt-1 text-stat leading-none ${bad ? 'text-bad' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

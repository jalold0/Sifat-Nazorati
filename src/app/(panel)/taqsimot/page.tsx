import { BarList } from '@/components/charts';
import { Badge, Callout, Card, CardHead, PageHead, Table } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { number, percent } from '@/lib/format';
import { KIND_LABEL, PRIORITY_LABEL } from '@/server/shared';

export const metadata = { title: 'Ish taqsimoti' };
export const dynamic = 'force-dynamic';

/**
 * Ish taqsimoti va KPI pasporti — tizimning "qonuni".
 * Har bir vazifa aniq bitta mas'ulga biriktirilgan, har bir KPI ning formulasi ko'rinadi.
 */
export default async function DistributionPage() {
  await requireSession();

  const [zones, tasks, indicators] = await Promise.all([
    db.zone.findMany({ orderBy: { code: 'asc' }, include: { owner: { select: { shortName: true } } } }),
    db.taskDef.findMany({
      orderBy: { no: 'asc' },
      include: {
        owner: { select: { shortName: true } },
        backup: { select: { shortName: true } },
      },
    }),
    db.kpiIndicator.findMany({
      orderBy: { no: 'asc' },
      include: { owner: { select: { shortName: true } } },
    }),
  ]);

  const byOwner = new Map<string, { total: number; proactive: number; reactive: number }>();
  for (const t of tasks) {
    const name = t.owner.shortName;
    const b = byOwner.get(name) ?? { total: 0, proactive: 0, reactive: 0 };
    b.total += 1;
    if (t.kind === 'PROACTIVE') b.proactive += 1;
    else b.reactive += 1;
    byOwner.set(name, b);
  }

  const loadRows = [...byOwner.entries()].sort((a, b) => b[1].total - a[1].total);
  const maxShare = tasks.length > 0 ? Math.max(...loadRows.map(([, b]) => b.total)) / tasks.length : 0;

  return (
    <>
      <PageHead
        eyebrow="Ish taqsimoti va KPI pasporti"
        title="Kim nima uchun javob beradi"
        lede="Har bir vazifa aniq bitta mas'ulga biriktirilgan, har biriga zaxira xodim belgilangan. Nizo bo'lmasligi uchun taqsimot ochiq turadi."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Zonalar" note="To'rt zona — to'rt mas'ul" />
          <Table>
            <thead>
              <tr>
                <th className="th w-10">Zona</th>
                <th className="th">Yo'nalish</th>
                <th className="th">Mas'ul</th>
                <th className="th">Asosiy natija</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.code}>
                  <td className="td font-semibold">{z.code}</td>
                  <td className="td">
                    <p className="font-medium">{z.name}</p>
                    <p className="mt-0.5 text-micro text-muted">{z.coverage}</p>
                  </td>
                  <td className="td whitespace-nowrap text-meta">{z.owner.shortName}</td>
                  <td className="td text-meta text-ink2">{z.outcome}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHead
            title="Yuklama muvozanati"
            note="Qoida: bitta xodimda vazifalarning 40% dan ortig'i to'planmasligi kerak"
          />
          <BarList
            data={loadRows.map(([name, b]) => ({
              label: `${name} — ${b.total} vazifa (${b.proactive} proaktiv)`,
              value: b.total,
              tone: b.total / tasks.length > 0.4 ? 'bad' : 'brand',
            }))}
          />
          <p className="mt-section text-meta text-ink2">
            Eng ko'p yuklangan xodimda vazifalarning {percent(maxShare, 0)} qismi.{' '}
            {maxShare > 0.4 ? (
              <span className="font-semibold text-bad">40% chegarasi buzilgan — taqsimotni qayta ko'rish kerak.</span>
            ) : (
              <span className="font-semibold text-ok">Chegara ichida.</span>
            )}
          </p>
        </Card>
      </div>

      <Card className="mt-section">
        <CardHead
          title={`Vazifalar katalogi — ${number(tasks.length)} ta`}
          note="Kunlik reyestrda murojaat shu katalogga bog'lanadi — shunda SLA va mas'ul avtomatik to'ldiriladi"
        />
        <Table stickyHead maxHeight={640}>
          <thead>
            <tr>
              <th className="th w-10">№</th>
              <th className="th w-10">Zona</th>
              <th className="th">Vazifa</th>
              <th className="th">Manba</th>
              <th className="th">Mas'ul</th>
              <th className="th">Zaxira</th>
              <th className="th">Davriylik</th>
              <th className="th text-right">SLA</th>
              <th className="th">Ustuvorlik</th>
              <th className="th">Tur</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td className="td tnum text-muted">{t.no}</td>
                <td className="td font-semibold">{t.zoneCode}</td>
                <td className="td max-w-[340px]">{t.title}</td>
                <td className="td text-meta text-ink2">{t.source}</td>
                <td className="td whitespace-nowrap text-meta">{t.owner.shortName}</td>
                <td className="td whitespace-nowrap text-meta text-muted">{t.backup?.shortName ?? '—'}</td>
                <td className="td whitespace-nowrap text-meta">{t.frequency}</td>
                <td className="td tnum text-right text-meta">{t.slaHours ? `${t.slaHours} soat` : '—'}</td>
                <td className="td">
                  <Badge tone={t.priority === 'CRITICAL' ? 'bad' : t.priority === 'HIGH' ? 'warn' : 'neutral'}>
                    {PRIORITY_LABEL[t.priority]}
                  </Badge>
                </td>
                <td className="td">
                  <Badge tone={t.kind === 'PROACTIVE' ? 'ok' : 'neutral'}>{KIND_LABEL[t.kind]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-section">
        <CardHead
          title={`KPI pasporti — ${number(indicators.length)} ko'rsatkich`}
          note="Har bir ko'rsatkichning formulasi va manbasi. Nizo chiqsa, shu jadval hal qiladi."
        />
        <Table stickyHead maxHeight={640}>
          <thead>
            <tr>
              <th className="th w-10">№</th>
              <th className="th">Kim uchun</th>
              <th className="th">Ko'rsatkich</th>
              <th className="th text-right">Og'irlik</th>
              <th className="th">Yo'nalish</th>
              <th className="th">Maqsad</th>
              <th className="th">Formula</th>
              <th className="th">Manba</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((i) => (
              <tr key={i.id}>
                <td className="td tnum text-muted">{i.no}</td>
                <td className="td whitespace-nowrap text-meta">{i.owner.shortName}</td>
                <td className="td font-medium">{i.name}</td>
                <td className="td tnum text-right">{number(Number(i.weight) * 100)}</td>
                <td className="td whitespace-nowrap text-meta">
                  {i.direction === 'HIGHER_BETTER' ? 'Yuqori yaxshi' : 'Past yaxshi'}
                </td>
                <td className="td whitespace-nowrap font-semibold">{i.targetText}</td>
                <td className="td max-w-[300px] text-micro text-ink2">{i.formula}</td>
                <td className="td text-micro">
                  <Badge tone={i.metricSource === 'AUTO' ? 'brand' : 'neutral'}>
                    {i.metricSource === 'AUTO' ? 'Avtomatik' : "Qo'lda"}
                  </Badge>
                  <p className="mt-1 text-muted">{i.dataSource}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Callout tone="bad" title="Ta'qiq">
        "Aniqlangan kamchiliklar soni" KPI qilib qo'yilmaydi — aks holda xodim kamchilik yasashga urinadi.
        O'lchanadigan narsa — kamchilikning bartaraf etilishi va takrorlanmasligi.
      </Callout>
    </>
  );
}

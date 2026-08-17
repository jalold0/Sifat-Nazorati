import Link from 'next/link';

import { BarList } from '@/components/charts';
import { Badge, Callout, Card, CardHead, Empty, PageHead, Table } from '@/components/ui';
import { SYSTEM_EPOCH } from '@/domain/assignment';
import { canManageSettings, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { date, dateTime, number, percent } from '@/lib/format';
import { currentLoad, recentReassignments } from '@/server/assignments';
import { KIND_LABEL, PRIORITY_LABEL } from '@/server/shared';

export const metadata = { title: 'Ish taqsimoti' };
export const dynamic = 'force-dynamic';

/**
 * Ish taqsimoti va KPI pasporti — tizimning "qonuni".
 * Har bir vazifa aniq bitta mas'ulga biriktirilgan, har bir KPI ning formulasi ko'rinadi.
 */
export default async function DistributionPage() {
  const session = await requireSession();
  const canEdit = canManageSettings(session.role);

  const [zones, tasks, indicators, load, changes] = await Promise.all([
    db.zone.findMany({ orderBy: { code: 'asc' }, include: { owner: { select: { shortName: true } } } }),
    db.taskDef.findMany({
      orderBy: { no: 'asc' },
      include: {
        owner: { select: { shortName: true } },
        backup: { select: { shortName: true } },
        // Joriy biriktirish — "qachondan buyon" ni ko'rsatish uchun
        assignments: { where: { until: null }, select: { from: true }, take: 1 },
      },
    }),
    db.kpiIndicator.findMany({
      orderBy: { no: 'asc' },
      include: { owner: { select: { shortName: true } } },
    }),
    currentLoad(),
    recentReassignments(12),
  ]);

  const activeTasks = tasks.filter((t) => t.active).length;
  const maxShare =
    activeTasks > 0 && load.length > 0 ? Math.max(...load.map((l) => l.total)) / activeTasks : 0;

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
            data={load.map((l) => ({
              label: `${l.name}${l.active ? '' : ' (faolsiz)'} — ${l.total} vazifa (${l.proactive} proaktiv)`,
              value: l.total,
              tone: !l.active ? 'warn' : l.total / activeTasks > 0.4 ? 'bad' : 'brand',
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
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td className="td tnum text-muted">{t.no}</td>
                <td className="td font-semibold">{t.zoneCode}</td>
                <td className="td max-w-[340px]">
                  <Link href={`/taqsimot/${t.no}`} className="transition hover:text-brand">
                    {t.title}
                  </Link>
                </td>
                <td className="td text-meta text-ink2">{t.source}</td>
                <td className="td whitespace-nowrap text-meta">
                  {t.owner.shortName}
                  {t.assignments[0] && t.assignments[0].from.getTime() !== SYSTEM_EPOCH.getTime() ? (
                    <p className="tnum text-micro text-muted">{date(t.assignments[0].from)} dan</p>
                  ) : null}
                </td>
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
                <td className="td whitespace-nowrap">
                  <Link href={`/taqsimot/${t.no}`} className="text-micro font-semibold text-brand">
                    {canEdit ? 'Qayta biriktirish' : 'Tarix'} &rarr;
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-section">
        <CardHead
          title="Qayta biriktirishlar tarixi"
          note="Boshlang'ich taqsimotdan keyingi barcha o'zgarishlar. O'zgartirishgacha bajarilgan ish eski mas'ul hisobida qoladi."
        />
        {changes.length === 0 ? (
          <Empty>Hali qayta biriktirish bo'lmagan — taqsimot boshlang'ich holatda.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Vazifa</th>
                <th className="th">Yangi mas'ul</th>
                <th className="th">Zaxira</th>
                <th className="th">Kuchga kirdi</th>
                <th className="th">Sabab</th>
                <th className="th">Kim o'zgartirdi</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id}>
                  <td className="td max-w-[280px]">
                    <Link href={`/taqsimot/${c.taskDef.no}`} className="font-semibold text-brand">
                      &#8470;{c.taskDef.no}
                    </Link>{' '}
                    <span className="text-meta">{c.taskDef.title}</span>
                  </td>
                  <td className="td whitespace-nowrap font-semibold">{c.owner.shortName}</td>
                  <td className="td whitespace-nowrap text-meta text-ink2">{c.backup?.shortName ?? '—'}</td>
                  <td className="td tnum whitespace-nowrap text-meta">{date(c.from)}</td>
                  <td className="td text-meta text-ink2">{c.reason ?? '—'}</td>
                  <td className="td whitespace-nowrap text-micro text-muted">
                    {c.changedBy?.shortName ?? 'tizim'}
                    <p className="tnum">{dateTime(c.createdAt)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
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

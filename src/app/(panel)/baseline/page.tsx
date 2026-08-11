import { BarList, ColumnChart, SplitBar } from '@/components/charts';
import { Badge, Callout, Card, CardHead, Empty, PageHead, StatTile, Table } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { date, dateTime, number, percent } from '@/lib/format';
import { baselineHistory, currentBaseline } from '@/server/baseline';

export const metadata = { title: 'Telegram baseline' };
export const dynamic = 'force-dynamic';

/**
 * Telegram baseline — tizim joriy etilishidan oldingi haqiqiy o'lchov.
 * Manba: uchala akkauntning eksporti, trek raqami bo'yicha dedublikatsiya qilingan.
 * Vaqti-vaqti bilan yangi eksport bilan yangilanadi; har yangilash tarixda qoladi.
 */
export default async function BaselinePage() {
  await requireSession();
  const [current, history] = await Promise.all([currentBaseline(), baselineHistory()]);

  if (!current) {
    return (
      <>
        <PageHead
          eyebrow="Telegram baseline"
          title="O'lchov hali yuklanmagan"
          lede="Telegram eksporti tahlili tizimga kiritilmagan."
        />
        <Callout tone="warn" title="Qanday yuklanadi">
          <ol className="ml-4 list-decimal space-y-1">
            <li>Telegram eksportini yangilab, Excel tahlilini shakllantiring</li>
            <li>
              <code>python scripts/extract_sources.py &quot;&lt;manba papka&gt;&quot;</code>
            </li>
            <li>
              <code>pnpm import:baseline --user &lt;login&gt; --note &quot;&lt;izoh&gt;&quot;</code>
            </li>
          </ol>
        </Callout>
      </>
    );
  }

  const s = current.summary;
  const cases2026 = current.months.filter((m) => m.period >= '2026-01').reduce((a, m) => a + m.cases, 0);

  const trend = current.months.map((m) => ({
    label: m.label.split(' ')[0]!,
    value: m.cases,
    tone: 'brand' as const,
  }));
  const avg102 =
    current.months.filter((m) => m.system102Cases).length > 0
      ? Math.round(
          current.months.reduce((a, m) => a + (m.system102Cases ?? 0), 0) /
            current.months.filter((m) => m.system102Cases).length,
        )
      : undefined;

  const peakHour = [...current.byHour].sort((a, b) => b.value - a.value)[0];

  return (
    <>
      <PageHead
        eyebrow={`Telegram baseline · ${date(current.periodFrom)} — ${date(current.periodTo)}`}
        title="O'lchanmagan kanal — haqiqiy hajm"
        lede="102 tizimi orqali kelgan murojaatlar har doim sanalgan. Telegram oqimi hech qachon o'lchanmagan. Uchala xodimning yozishmalari tahlil qilinganda, bu kanal 102 dan bir necha barobar katta ekani aniqlandi."
        actions={
          <div className="text-right text-[11.5px] text-muted">
            <p>
              Versiya #{current.id} · {dateTime(current.importedAt)}
            </p>
            <p>Yuklagan: {current.importedByName ?? 'tizim'}</p>
          </div>
        }
      />

      {/* ── Ikki kanalning nisbati ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[5px]" style={{ background: 'var(--brand)' }} />
          <p className="text-[12.5px] font-semibold text-ink2">TELEGRAM</p>
          <p className="text-[12px] text-muted">O'lchanmagan kanal · tizim yo'q, status yo'q</p>
          <p className="tnum mt-3 text-[42px] font-semibold leading-none tracking-[-0.035em] text-brand">
            {number(cases2026)}
          </p>
          <p className="mt-2 text-[12.5px] text-ink2">unikal ish · 2026 yil, trek raqami bo'yicha takrorsiz</p>
          <p className="mt-2 border-t border-grid pt-2 text-[11.5px] text-muted">
            Butun kuzatuv davri bo'yicha — {number(s.totalCases)} ta ish.
          </p>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[5px]" style={{ background: 'var(--accent)' }} />
          <p className="text-[12.5px] font-semibold text-ink2">102 TIZIMI</p>
          <p className="text-[12px] text-muted">Tizimli kanal · status, arxiv, hisobot bor</p>
          <p className="tnum mt-3 text-[42px] font-semibold leading-none tracking-[-0.035em] text-accent">
            {number(s.system102Cases)}
          </p>
          <p className="mt-2 text-[12.5px] text-ink2">murojaat · platformadagi &quot;Jami&quot; ustuni</p>
          <p className="mt-2 border-t border-grid pt-2 text-[11.5px] text-muted">
            Nisbat: Telegram oqimi 102 dan{' '}
            <b className="text-ink">{number(s.channelRatio, 2)}×</b> katta.
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHead
          title="Kanallar ulushi"
          note="Bo'lim ish hajmining asosiy qismi hisobotlarda ko'rinmayapti"
        />
        <SplitBar
          parts={[
            { label: 'Telegram', value: cases2026, tone: 'brand' },
            { label: '102 tizimi', value: s.system102Cases, tone: 'accent' },
          ]}
          height={18}
        />
      </Card>

      {/* ── Ishlar holati ─────────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Telegramda javob izi yo'q"
          value={number(s.noTraceCases)}
          tone="bad"
          hint={`${percent(s.noTraceShare, 1)} — mijoz javob olmagan`}
        />
        <StatTile
          label="Birinchi javob (median)"
          value={`${number(s.medianFirstResponseMin, 1)} daq`}
          hint={`1 soat ichida ${percent(s.within1hShare, 0)}`}
        />
        <StatTile
          label="Ish vaqtidan tashqari"
          value={percent(s.outsideHoursShare, 0)}
          hint="09:00–18:00 dan tashqarida keladi"
        />
        <StatTile
          label="Xodimlar o'rtasida takrorlangan"
          value={number(s.sharedCases)}
          tone="warn"
          hint="bitta ish bir necha kishida"
        />
      </div>

      <Callout tone="bad" title={`${number(s.noTraceCases)} ta ishda Telegramda javob izi yo'q`}>
        Bu ishlar bajarilmagan degani emas — ko'pchiligi telefon orqali yoki ichki tizimda hal qilingan. Muammo
        shundaki, buni <i>isbotlab bo'lmaydi</i>: chatda status yo'q, shuning uchun na mijoz, na rahbariyat masala
        yopilganini ko'ra oladi. 102 da bunday holat bo'lishi mumkin emas.
      </Callout>

      {/* ── Oylik dinamika ───────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="Telegram oqimi oyma-oy"
          note="Punktir chiziq — 102 tizimining oylik o'rtachasi. Har oyda Telegram oqimi 102 dan ikki-uch barobar yuqori."
        />
        <ColumnChart
          data={trend}
          reference={avg102}
          referenceLabel={avg102 ? `102 — oyiga o'rtacha ${number(avg102)}` : undefined}
        />
      </Card>

      {/* ── Akkauntlar kesimi ────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="Akkauntlar kesimi"
          note="Ustunlar yig'indisi umumiy raqamdan katta: ulashilgan ishlar har ikkala akkauntda sanaladi"
        />
        <Table>
          <thead>
            <tr>
              <th className="th">Akkaunt</th>
              <th className="th text-right">Ish</th>
              <th className="th text-right">Faqat o'zida</th>
              <th className="th text-right">Ulashilgan</th>
              <th className="th text-right">Suhbat</th>
              <th className="th text-right">Trek</th>
              <th className="th text-right">Mijoz</th>
              <th className="th text-right">Ishlanmagan</th>
              <th className="th text-right">Median javob</th>
              <th className="th text-right">1 soat ichida</th>
            </tr>
          </thead>
          <tbody>
            {current.accounts.map((a) => (
              <tr key={a.account}>
                <td className="td font-medium">{a.account}</td>
                <td className="td tnum text-right font-semibold">{number(a.cases)}</td>
                <td className="td tnum text-right">{number(a.ownOnly)}</td>
                <td className="td tnum text-right">{number(a.shared)}</td>
                <td className="td tnum text-right">{number(a.sessions)}</td>
                <td className="td tnum text-right">{number(a.tracks)}</td>
                <td className="td tnum text-right">{number(a.customers)}</td>
                <td className="td tnum text-right text-bad">{number(a.unanswered)}</td>
                <td className="td tnum text-right">{a.medianMin === null ? '—' : `${number(a.medianMin, 1)} daq`}</td>
                <td className="td tnum text-right">{percent(a.within1h, 0)}</td>
              </tr>
            ))}
            <tr>
              <td className="td font-semibold">Yig'indi (takror bilan)</td>
              <td className="td tnum text-right font-semibold">{number(s.accountsSum)}</td>
              <td className="td" colSpan={8} />
            </tr>
            <tr>
              <td className="td font-semibold text-ok">Haqiqiy jami (takrorsiz)</td>
              <td className="td tnum text-right font-semibold text-ok">{number(s.totalCases)}</td>
              <td className="td text-[11.5px] text-muted" colSpan={8}>
                {number(s.sharedCases)} ta takrorlangan ish bir marta sanaldi · {number(s.excludedCases)} ta shubhali
                chat hisobga olinmadi
              </td>
            </tr>
          </tbody>
        </Table>

        <Callout tone="warn" title="Hisobotda faqat takrorsiz raqam ishlatiladi">
          Uchta akkauntni qo'shib bo'lmaydi — {number(s.accountsSum)} soni bir ishni bir necha marta sanaydi. To'g'ri
          raqam — {number(s.totalCases)}.
        </Callout>
      </Card>

      {/* ── Yuklama profili ──────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Soatlik yuklama"
            note={
              peakHour
                ? `Eng yuqori nuqta — ${peakHour.label} (${number(peakHour.value)} xabar)`
                : undefined
            }
          />
          <ColumnChart
            data={current.byHour.map((h) => ({
              label: h.label.slice(0, 2),
              value: h.value,
              tone: Number(h.label.slice(0, 2)) >= 9 && Number(h.label.slice(0, 2)) < 18 ? 'ok' : 'muted',
            }))}
            height={190}
            valueFormat={() => ''}
          />
          <p className="mt-2 text-[11.5px] text-muted">
            Yashil — ish vaqti (09:00–18:00). Kulrang ustunlar ish vaqtidan tashqari oqim:{' '}
            {percent(s.outsideHoursShare, 0)}.
          </p>
        </Card>

        <Card>
          <CardHead title="Hafta kunlari bo'yicha" note="Kiruvchi xabarlar soni" />
          <BarList
            data={current.byWeekday.map((d) => ({
              label: d.label,
              value: d.value,
              tone: d.label === 'Yakshanba' ? 'muted' : 'brand',
            }))}
          />
        </Card>
      </div>

      {/* ── Mavzular ─────────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="Mavzular tasnifi"
          note="Avtomatik aniqlangan. Eng ko'p uchraydigan mavzular — bot va avtomatlashtirish uchun birinchi nishon."
        />
        <BarList
          data={current.byTopic.map((t) => ({
            label: t.label,
            value: t.value,
            tone: t.label.startsWith('Boshqa') ? 'muted' : 'brand',
          }))}
        />
      </Card>

      {/* ── 102 tizimi ───────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="102 tizimi — xodimlar kesimi"
          note="Rahbar qatoridagi murojaatlarning bir qismi mutaxassislar bilan kesishadi: tasdiqlashdan oldin u ham tekshiruv o'tkazadi."
        />
        <Table>
          <thead>
            <tr>
              <th className="th">Xodim</th>
              <th className="th">Login</th>
              <th className="th">Rol</th>
              <th className="th text-right">Jami</th>
              <th className="th text-right">Status</th>
              <th className="th text-right">Arxiv</th>
              <th className="th text-right">Tasdiq</th>
            </tr>
          </thead>
          <tbody>
            {current.operators.map((o) => (
              <tr key={o.login}>
                <td className="td font-medium">{o.name}</td>
                <td className="td tnum text-[12px] text-muted">{o.login}</td>
                <td className="td text-[12px]">{o.role}</td>
                <td className="td tnum text-right font-semibold">{number(o.total)}</td>
                <td className="td tnum text-right">{number(o.status)}</td>
                <td className="td tnum text-right">{number(o.archive)}</td>
                <td className="td tnum text-right">{number(o.approved)}</td>
              </tr>
            ))}
            <tr>
              <td className="td font-semibold" colSpan={3}>
                JAMI
              </td>
              <td className="td tnum text-right font-semibold">{number(s.system102Cases)}</td>
              <td className="td" colSpan={3} />
            </tr>
          </tbody>
        </Table>
      </Card>

      {/* ── Import tarixi ────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHead
          title="Yangilanish tarixi"
          note="Har bir eksport yangi versiya bo'lib saqlanadi — eski o'lchov o'chmaydi"
        />
        <Table>
          <thead>
            <tr>
              <th className="th w-12">Versiya</th>
              <th className="th">Yangilangan sana</th>
              <th className="th">Kim yukladi</th>
              <th className="th text-right">Jami ish</th>
              <th className="th text-right">O'zgarish</th>
              <th className="th text-right">Javob izi yo'q</th>
              <th className="th">Izoh · manba</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className={h.isCurrent ? 'bg-brand/[0.04]' : undefined}>
                <td className="td tnum">
                  #{h.id}
                  {h.isCurrent ? (
                    <Badge tone="brand" className="ml-1.5">
                      joriy
                    </Badge>
                  ) : null}
                </td>
                <td className="td tnum whitespace-nowrap">{dateTime(h.importedAt)}</td>
                <td className="td text-[12.5px]">{h.importedByName ?? 'tizim'}</td>
                <td className="td tnum text-right font-semibold">{number(h.totalCases)}</td>
                <td className="td tnum text-right">
                  {h.delta === null ? (
                    <span className="text-muted">birinchi</span>
                  ) : h.delta === 0 ? (
                    <span className="text-muted">0</span>
                  ) : (
                    <span className={h.delta > 0 ? 'text-ok' : 'text-bad'}>
                      {h.delta > 0 ? '+' : ''}
                      {number(h.delta)}
                    </span>
                  )}
                </td>
                <td className="td tnum text-right">{number(h.noTraceCases)}</td>
                <td className="td text-[11.5px] text-muted">
                  {h.note ?? '—'}
                  {h.sourceFile ? <p className="tnum">{h.sourceFile}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {history.length === 0 ? <Empty>Tarix bo'sh.</Empty> : null}
      </Card>

      <Callout tone="brand" title="Qanday yangilanadi">
        Telegram eksportini yangilagandan keyin:{' '}
        <code className="rounded bg-raised px-1.5 py-0.5">python scripts/extract_sources.py</code> →{' '}
        <code className="rounded bg-raised px-1.5 py-0.5">
          pnpm import:baseline --user &lt;login&gt; --note &quot;izoh&quot;
        </code>
        . Yangi versiya joriy bo'ladi, eskisi tarixda sanasi va muallifi bilan qoladi. To'g'ridan-to'g'ri
        Telegram → CRM integratsiyasi paydo bo'lgandan keyin bu qo'lda qadam yo'qoladi.
      </Callout>

      <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted">
        Metodika: 1 ish = 1 unikal trek. Treksiz murojaatlar (mijoz + kun) juftligi bo'yicha bitta ish deb olingan.
        OTK xodimlarining o'zaro yozishmasi ({number(s.totalSessions)} suhbatdan) umumiy hisobdan chiqarilgan.
        Jami xabar: {number(s.totalMessages)}.
        <br />
        Manba: {current.sourceFile ?? "Telegram eksporti"} · davr {date(current.periodFrom)} — {date(current.periodTo)}
      </p>
    </>
  );
}

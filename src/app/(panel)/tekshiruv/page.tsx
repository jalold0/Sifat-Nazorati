import Link from 'next/link';

import { Badge, Callout, Card, CardHead, Empty, PageHead, ProgressBar, StatTile, Table } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { date, number, percent } from '@/lib/format';
import { REVIEW_RESULT_LABEL } from '@/server/shared';

import { ResultForm } from './result-form';

export const metadata = { title: "Tekshirish ro'yxati" };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ natija?: string; trek?: string; sahifa?: string; qidiruv?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.sahifa ?? '1') || 1);

  const where = {
    ...(sp.natija ? { result: sp.natija as 'PENDING' | 'RESOLVED' | 'UNRESOLVED' | 'NOT_RELEVANT' } : {}),
    ...(sp.trek === 'bor' ? { hasTrack: true } : sp.trek === 'yoq' ? { hasTrack: false } : {}),
    ...(sp.qidiruv
      ? {
          OR: [
            { track: { contains: sp.qidiruv, mode: 'insensitive' as const } },
            { customer: { contains: sp.qidiruv, mode: 'insensitive' as const } },
            { text: { contains: sp.qidiruv, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, total, counts, byCategory] = await Promise.all([
    db.reviewItem.findMany({
      where,
      orderBy: [{ result: 'asc' }, { occurredOn: 'asc' }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { assignedTo: { select: { shortName: true } } },
    }),
    db.reviewItem.count({ where }),
    db.reviewItem.groupBy({ by: ['result'], _count: { _all: true } }),
    db.reviewItem.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
      take: 8,
    }),
  ]);

  const countOf = (r: string) => counts.find((c) => c.result === r)?._count._all ?? 0;
  const all = counts.reduce((s, c) => s + c._count._all, 0);
  const checked = all - countOf('PENDING');
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const query = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    return `?${next.toString()}`;
  };

  return (
    <>
      <PageHead
        eyebrow="Tekshirish ro'yxati"
        title="Telegramda javob izi qolmagan ishlar"
        lede="Bu ishlar bajarilmagan degani emas. Ko'pchiligi telefon orqali yoki ichki tizimda hal qilingan — muammo shundaki, buni isbotlab bo'lmaydi. Har bir qatorni tekshirib natijasini belgilang."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Tekshirildi"
          value={`${number(checked)} / ${number(all)}`}
          tone={all > 0 && checked === all ? 'ok' : 'neutral'}
          hint={percent(all > 0 ? checked / all : null, 0)}
        />
        <StatTile label="Hal qilingan" value={number(countOf('RESOLVED'))} tone="ok" />
        <StatTile label="Hal qilinmagan" value={number(countOf('UNRESOLVED'))} tone="bad" />
        <StatTile label="Ishga aloqasiz" value={number(countOf('NOT_RELEVANT'))} />
      </div>

      <div className="mt-3">
        <ProgressBar value={all > 0 ? checked / all : 0} tone="brand" />
      </div>

      <Callout tone="brand" title="Nima uchun bu ro'yxat kerak">
        Telegram chat bo'lgani uchun unda status yo'q — na mijoz, na rahbariyat masala yopilganini ko'ra olmaydi.
        Tekshiruvdan keyin "javob izi yo'q" raqami sezilarli kamayadi, qolgani esa haqiqiy muammo bo'lib qoladi va
        botga o'tish zaruratini raqam bilan asoslaydi.
      </Callout>

      {byCategory.length > 0 ? (
        <Card className="mt-section">
          <CardHead title="Kategoriyalar" note="Qaysi mavzuda iz qolmagani ko'proq" />
          <Table>
            <thead>
              <tr>
                <th className="th">Kategoriya</th>
                <th className="th text-right">Ish</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.category}>
                  <td className="td">{c.category}</td>
                  <td className="td tnum text-right font-semibold">{number(c._count._all)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      <Card className="mt-section no-print" padded={false}>
        <form method="get" className="grid gap-3 p-4 sm:grid-cols-4">
          <div>
            <label className="field-label" htmlFor="natija">
              Natija
            </label>
            <select id="natija" name="natija" className="field" defaultValue={sp.natija ?? ''}>
              <option value="">Hammasi</option>
              {Object.entries(REVIEW_RESULT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="trek">
              Trek raqami
            </label>
            <select id="trek" name="trek" className="field" defaultValue={sp.trek ?? ''}>
              <option value="">Hammasi</option>
              <option value="bor">Trek bor</option>
              <option value="yoq">Treksiz</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="qidiruv">
              Qidiruv
            </label>
            <input id="qidiruv" name="qidiruv" className="field" defaultValue={sp.qidiruv ?? ''} placeholder="trek, mijoz, matn" />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-brand">
              Filtr
            </button>
            <Link href="/tekshiruv" className="btn-ghost">
              Tozalash
            </Link>
          </div>
        </form>
      </Card>

      <Card className="mt-section" padded={false}>
        {rows.length === 0 ? (
          <div className="p-5">
            <Empty>Bu shartlar bo'yicha yozuv topilmadi.</Empty>
          </div>
        ) : (
          <>
            <Table stickyHead maxHeight={760}>
              <thead>
                <tr>
                  <th className="th">Sana</th>
                  <th className="th">Trek</th>
                  <th className="th">Mijoz / manba</th>
                  <th className="th">Kategoriya</th>
                  <th className="th">Matn</th>
                  <th className="th">Natija</th>
                  <th className="th w-[180px]">Tekshirish</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td tnum whitespace-nowrap text-meta">{date(r.occurredOn)}</td>
                    <td className="td tnum text-meta">{r.track ?? '—'}</td>
                    <td className="td text-meta">
                      {r.customer}
                      <p className="text-micro text-muted">{r.originType}</p>
                    </td>
                    <td className="td text-meta">{r.category}</td>
                    <td className="td max-w-[300px]">
                      <p className="line-clamp-2 text-meta text-ink2">{r.text || '—'}</p>
                      <p className="mt-0.5 text-micro text-muted">{r.account}</p>
                    </td>
                    <td className="td">
                      <Badge
                        tone={
                          r.result === 'RESOLVED'
                            ? 'ok'
                            : r.result === 'UNRESOLVED'
                              ? 'bad'
                              : r.result === 'NOT_RELEVANT'
                                ? 'neutral'
                                : 'warn'
                        }
                      >
                        {REVIEW_RESULT_LABEL[r.result]}
                      </Badge>
                      {r.resolvedWhere ? <p className="mt-1 text-micro text-muted">{r.resolvedWhere}</p> : null}
                      {r.assignedTo ? <p className="text-micro text-muted">{r.assignedTo.shortName}</p> : null}
                    </td>
                    <td className="td">
                      <ResultForm id={r.id} result={r.result} resolvedWhere={r.resolvedWhere} note={r.note} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="flex items-center justify-between gap-3 border-t border-grid px-4 py-3">
              <p className="text-meta text-muted">
                {number((page - 1) * PAGE_SIZE + 1)}–{number(Math.min(page * PAGE_SIZE, total))} / {number(total)} ta
              </p>
              <div className="flex gap-2">
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

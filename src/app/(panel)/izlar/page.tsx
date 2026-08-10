import { Card, Empty, PageHead, Table } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { dateTime, number } from '@/lib/format';

export const metadata = { title: "O'zgarishlar izi" };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 80;

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Tizimga kirdi',
  'ticket.create': 'Murojaat qo‘shdi',
  'ticket.close': 'Murojaatni yopdi',
  'ticket.escalate': 'Eskalatsiya qildi',
  'ticket.respond': 'Birinchi javobni belgiladi',
  'audit.create': 'Audit kiritdi',
  'kpi.recalculate': 'KPI qayta hisoblandi',
  'kpi.override': 'KPI faktini qo‘lda tuzatdi',
  'period.trial': 'Sinov rejimiga o‘tkazdi',
  'period.draft': 'Davrni qayta ochdi',
  'period.submitted': 'Rahbariyatga yubordi',
  'period.approved': 'Davrni tasdiqladi',
  'period.rejected': 'Davrni qaytardi',
  'solution.create': 'Tizimli yechim qo‘shdi',
  'solution.status': 'Yechim holatini o‘zgartirdi',
  'review.result': 'Tekshirish natijasini belgiladi',
  'capacity.save': 'Quvvat sxemasini saqladi',
  'user.update': 'Xodim ma‘lumotini o‘zgartirdi',
  'import.baseline': 'Baseline ma‘lumotini yukladi',
};

/**
 * O'zgarishlar izi — CEO nazoratining asosi.
 * KPI faktini qo'lda tuzatish, davrni tasdiqlash kabi har bir muhim amal shu yerda qoladi.
 */
export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ sahifa?: string; amal?: string }>;
}) {
  await requireRole('CEO', 'HEAD');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.sahifa ?? '1') || 1);

  const where = sp.amal ? { action: sp.amal } : {};
  const [rows, total, kinds] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { actor: { select: { shortName: true } } },
    }),
    db.activityLog.count({ where }),
    db.activityLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { _count: { action: 'desc' } } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHead
        eyebrow="Nazorat izi"
        title="O'zgarishlar tarixi"
        lede="Har bir muhim amal — KPI faktini qo'lda tuzatish, davrni tasdiqlash, murojaatni yopish — shu yerda qoladi. Raqamning qayerdan kelgani har doim tekshirilishi mumkin."
      />

      <Card className="no-print" padded={false}>
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[240px]">
            <label className="field-label" htmlFor="amal">
              Amal turi
            </label>
            <select id="amal" name="amal" className="field" defaultValue={sp.amal ?? ''}>
              <option value="">Hammasi ({number(total)})</option>
              {kinds.map((k) => (
                <option key={k.action} value={k.action}>
                  {ACTION_LABEL[k.action] ?? k.action} ({k._count._all})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-brand">
            Filtr
          </button>
        </form>
      </Card>

      <Card className="mt-4" padded={false}>
        {rows.length === 0 ? (
          <div className="p-5">
            <Empty>Hozircha yozuv yo'q.</Empty>
          </div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th className="th">Vaqt</th>
                  <th className="th">Kim</th>
                  <th className="th">Amal</th>
                  <th className="th">Tafsilot</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td tnum whitespace-nowrap text-[12px] text-ink2">{dateTime(r.createdAt)}</td>
                    <td className="td whitespace-nowrap text-[12.5px] font-medium">{r.actor?.shortName ?? 'tizim'}</td>
                    <td className="td whitespace-nowrap text-[12.5px]">{ACTION_LABEL[r.action] ?? r.action}</td>
                    <td className="td text-[12px] text-ink2">{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="flex items-center justify-between gap-3 border-t border-grid px-4 py-3">
              <p className="text-[12px] text-muted">
                {number((page - 1) * PAGE_SIZE + 1)}–{number(Math.min(page * PAGE_SIZE, total))} / {number(total)}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <a href={`?sahifa=${page - 1}${sp.amal ? `&amal=${sp.amal}` : ''}`} className="btn-ghost">
                    Oldingi
                  </a>
                ) : null}
                {page < pages ? (
                  <a href={`?sahifa=${page + 1}${sp.amal ? `&amal=${sp.amal}` : ''}`} className="btn-ghost">
                    Keyingi
                  </a>
                ) : null}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

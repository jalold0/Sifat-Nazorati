import { Badge, Callout, Card, CardHead, PageHead, Table } from '@/components/ui';
import { canManageSettings, canSeeSalary, requireSession, ROLE_LABEL } from '@/lib/auth';
import { db } from '@/lib/db';
import { dateTime, money, number } from '@/lib/format';

import { PasswordForm, UserForm } from './forms';

export const metadata = { title: 'Sozlamalar' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await requireSession();
  const canEdit = canManageSettings(session.role);
  const showMoney = canSeeSalary(session.role);

  const [users, indicatorCounts, templates, periods] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: 'asc' }, { shortName: 'asc' }],
      include: { _count: { select: { indicators: true, ownedTasks: true } } },
    }),
    db.kpiIndicator.groupBy({ by: ['metricSource'], _count: { _all: true } }),
    db.checklistTemplate.findMany({ include: { _count: { select: { items: true, audits: true } } } }),
    db.kpiPeriod.findMany({ orderBy: { period: 'desc' }, take: 6 }),
  ]);

  const autoCount = indicatorCounts.find((c) => c.metricSource === 'AUTO')?._count._all ?? 0;
  const manualCount = indicatorCounts.find((c) => c.metricSource === 'MANUAL')?._count._all ?? 0;

  return (
    <>
      <PageHead
        eyebrow="Sozlamalar"
        title="Xodimlar, maosh va tizim holati"
        lede="Maosh faqat bonus hisobi uchun ishlatiladi. KPI og'irliklari va maqsadlari ish taqsimoti sahifasida ko'rinadi."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="eyebrow">KPI ko'rsatkichlari</p>
          <p className="tnum mt-1 text-stat leading-none">{number(autoCount + manualCount)}</p>
          <p className="mt-2 text-meta text-ink2">
            {number(autoCount)} ta avtomatik (reyestrdan) · {number(manualCount)} ta qo'lda kiritiladi
          </p>
        </Card>
        <Card>
          <p className="eyebrow">Checklistlar</p>
          <p className="tnum mt-1 text-stat leading-none">{number(templates.length)}</p>
          <p className="mt-2 text-meta text-ink2">
            {templates.map((t) => `${t._count.items} band`).join(' · ')}
          </p>
        </Card>
        <Card>
          <p className="eyebrow">Ochilgan davrlar</p>
          <p className="tnum mt-1 text-stat leading-none">{number(periods.length)}</p>
          <p className="mt-2 text-meta text-ink2">
            {periods.filter((p) => p.status === 'APPROVED').length} ta tasdiqlangan
          </p>
        </Card>
      </div>

      <Card className="mt-section">
        <CardHead
          title="Xodimlar"
          note="Maosh kiritilmagan xodimga bonus hisoblanmaydi — ball baribir hisoblanadi"
        />
        <Table>
          <thead>
            <tr>
              <th className="th">Xodim</th>
              <th className="th">Login</th>
              <th className="th">Rol</th>
              <th className="th text-right">Vazifa</th>
              <th className="th text-right">KPI</th>
              {showMoney ? <th className="th text-right">Maosh</th> : null}
              <th className="th">Oxirgi kirish</th>
              <th className="th w-[200px]">Ma'lumot</th>
              <th className="th w-[200px]">Parol</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td">
                  <p className="font-semibold">{u.fullName}</p>
                  <p className="text-micro text-muted">{u.position}</p>
                  {!u.active ? (
                    <Badge tone="bad" className="mt-1">
                      Faolsiz
                    </Badge>
                  ) : null}
                </td>
                <td className="td tnum text-meta">{u.login}</td>
                <td className="td text-meta">{ROLE_LABEL[u.role]}</td>
                <td className="td tnum text-right">{number(u._count.ownedTasks)}</td>
                <td className="td tnum text-right">{number(u._count.indicators)}</td>
                {showMoney ? <td className="td tnum text-right">{money(u.salary ? Number(u.salary) : null)}</td> : null}
                <td className="td tnum whitespace-nowrap text-micro text-muted">{dateTime(u.lastLoginAt)}</td>
                <td className="td">
                  <UserForm
                    id={u.id}
                    position={u.position}
                    salary={u.salary ? Number(u.salary) : null}
                    active={u.active}
                    canEdit={canEdit}
                  />
                </td>
                <td className="td">
                  {u.id === session.sub || canEdit ? (
                    <PasswordForm id={u.id} label={u.id === session.sub ? 'O‘z parolim' : 'Yangi parol'} />
                  ) : (
                    <span className="text-meta text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Callout tone="warn" title="Xavfsizlik">
        Boshlang'ich parollar seed paytida bir xil qo'yiladi. Har bir xodim birinchi kirishdan keyin o'z parolini
        albatta almashtirishi kerak. Maosh ma'lumotini faqat rahbariyat, bo'lim boshlig'i va kuzatuvchi rol ko'radi.
      </Callout>
    </>
  );
}

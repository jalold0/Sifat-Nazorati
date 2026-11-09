import type { Metadata } from 'next';

import { DeptReport, PeriodTabs } from '@/modules/hisobot/ui';
import { AutoRefresh } from '@/shared/ui/auto-refresh';
import { TaskList } from '@/modules/auditlar/ui';
import { Empty, PageHead } from '@/shared/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { listTasks } from '@/modules/auditlar';
import { loadReport, parsePeriod } from '@/modules/hisobot';

export const metadata: Metadata = { title: 'Bo‘limim' };
export const dynamic = 'force-dynamic';

/** Ko'ruvchi: panelning o'z bo'limi uchun nusxasi + shu bo'limga berilgan topshiriqlar. Hech narsa o'zgartirib bo'lmaydi. */
export default async function BolimimPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const actor = await requireActorFor('VIEWER', 'SUPERVISOR');
  const period = parsePeriod((await searchParams).p);

  if (!actor.deptId) {
    return (
      <>
        <PageHead title="Bo‘limim" />
        <Empty>Sizga bo‘lim biriktirilmagan. Rahbarga murojaat qiling: Sozlamalar → Foydalanuvchilar.</Empty>
      </>
    );
  }

  const res = await loadReport(actor, period, actor.deptId);
  if (!res.ok) return <p className="text-bad">{res.error}</p>;
  const item = res.data.items[0];
  if (!item) return <Empty>Bo‘lim topilmadi yoki faol emas.</Empty>;

  const [overdue, open] = await Promise.all([
    listTasks(actor, { dept: actor.deptId, status: 'open', dueBefore: res.data.today }),
    listTasks(actor, { dept: actor.deptId, status: 'open' }),
  ]);
  const openOnly = open.ok ? open.data.filter((t) => t.due >= res.data.today) : [];

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHead eyebrow="Bo‘limim" title={item.dept.name} actions={<PeriodTabs base="/bolimim" period={period} />} />
      <DeptReport
        data={item}
        overdueTasks={overdue.ok ? overdue.data : []}
        today={res.data.today}
        canClose={false}
      />
      <section className="mt-section">
        <h2 className="mb-3 text-title">Bo‘limga berilgan ochiq topshiriqlar</h2>
        <TaskList
          tasks={openOnly}
          departments={[item.dept]}
          today={res.data.today}
          canClose={false}
          showDept={false}
          emptyText="Ochiq topshiriq yo‘q"
        />
      </section>
    </>
  );
}

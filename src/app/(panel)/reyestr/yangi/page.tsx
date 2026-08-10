import { redirect } from 'next/navigation';

import { Callout, Card, PageHead } from '@/components/ui';
import { canWrite, requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { dateInputValue, dateTimeInputValue } from '@/lib/format';

import { TicketForm } from '../ticket-form';

export const metadata = { title: 'Yangi murojaat' };

export default async function NewTicketPage() {
  const session = await requireSession();
  if (!canWrite(session.role)) redirect('/ruxsat-yoq');

  const [tasks, users] = await Promise.all([
    db.taskDef.findMany({
      where: { active: true },
      orderBy: { no: 'asc' },
      select: {
        id: true,
        no: true,
        zoneCode: true,
        title: true,
        ownerId: true,
        slaHours: true,
        priority: true,
        kind: true,
        source: true,
      },
    }),
    db.user.findMany({
      where: { active: true, role: { in: ['HEAD', 'SPECIALIST'] } },
      orderBy: { shortName: 'asc' },
      select: { id: true, shortName: true },
    }),
  ]);

  const now = new Date();

  return (
    <>
      <PageHead
        eyebrow="Kunlik reyestr"
        title="Yangi murojaat qayd etish"
        lede="Har bir murojaat shu yerga yoziladi — KPI, quvvat hisobi va oylik hisobot faqat shu ma'lumotdan yig'iladi."
      />

      <Callout tone="brand" title="Uch qoida">
        Murojaat kelgan kuni qayd etiladi — keyinga qoldirilmaydi. Yopishda sabab (root cause) majburiy — usiz
        muammo takrorlanaveradi. Sarflangan vaqt yozilmasa, shtat masalasini raqam bilan asoslab bo'lmaydi.
      </Callout>

      <Card className="mt-4">
        <TicketForm
          tasks={tasks}
          users={users}
          defaultOwnerId={users.find((u) => u.id === session.sub)?.id ?? users[0]?.id ?? ''}
          today={dateInputValue(now)}
          now={dateTimeInputValue(now)}
        />
      </Card>
    </>
  );
}

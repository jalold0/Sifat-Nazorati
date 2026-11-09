import type { Metadata } from 'next';
import Link from 'next/link';

import { Empty, PageHead } from '@/components/ui';
import { requireActorFor } from '@/modules/foydalanuvchilar/ui';
import { getTest, listTraining } from '@/server/training';

import { TestForm } from './test-form';

export const metadata: Metadata = { title: 'Yakuniy test' };
export const dynamic = 'force-dynamic';

export default async function TestPage({ params }: { params: Promise<{ dept: string }> }) {
  const actor = await requireActorFor('HEAD', 'INSPECTOR');
  const { dept } = await params;

  const back = (
    <p className="mb-3 text-meta">
      <Link href={`/oquv?d=${dept}`} className="inline-flex min-h-[44px] items-center text-brand hover:underline">
        ← O‘quv dasturi
      </Link>
    </p>
  );

  const test = await getTest(actor, dept);
  if (!test.ok) {
    return (
      <>
        {back}
        <PageHead title="Yakuniy test" />
        <Empty>{test.error}</Empty>
      </>
    );
  }

  const list = await listTraining(actor);
  const mine = list.ok ? list.data.find((t) => t.deptId === dept) : undefined;
  if (mine && !mine.progress.complete) {
    return (
      <>
        {back}
        <PageHead title={test.data.deptName} eyebrow="Yakuniy test" />
        <Empty>
          Avval topshiriqlarni bajaring: o‘quv dasturida yana {mine.progress.total - mine.progress.done} ta topshiriq
          belgilanmagan.
        </Empty>
      </>
    );
  }

  return (
    <>
      {back}
      <PageHead eyebrow="Yakuniy test" title={test.data.deptName} lede={`O‘tish: ${test.data.passPct}% va undan yuqori. Hamma savolga javob bering, so‘ng «Topshirish» ni bosing.`} />
      <TestForm test={test.data} />
    </>
  );
}

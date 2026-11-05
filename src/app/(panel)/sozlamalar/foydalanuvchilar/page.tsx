import type { Metadata } from 'next';
import Link from 'next/link';

import { Empty, PageHead } from '@/components/ui';
import { requireActorFor } from '@/lib/auth';
import { listDepartments } from '@/server/qc';
import { listUsers } from '@/server/users';

import { UserRow, NewUserForm } from './user-forms';

export const metadata: Metadata = { title: 'Foydalanuvchilar' };
export const dynamic = 'force-dynamic';

export default async function FoydalanuvchilarPage() {
  const actor = await requireActorFor('HEAD');
  const [users, departments] = await Promise.all([listUsers(actor), listDepartments(actor, { includeInactive: true })]);
  const deptOptions = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <>
      <p className="mb-3 text-meta">
        <Link href="/sozlamalar" className="inline-flex min-h-[44px] items-center text-brand hover:underline">
          ← Sozlamalar
        </Link>
      </p>
      <PageHead
        eyebrow="Rahbar"
        title="Foydalanuvchilar"
        lede="Ko‘ruvchi faqat o‘z bo‘limini ko‘radi: unga bo‘lim biriktiring."
      />
      {users.ok && users.data.length > 0 ? (
        <ul className="space-y-3">
          {users.data.map((u) => (
            <UserRow key={u.id} user={u} departments={deptOptions} self={u.id === actor.id} />
          ))}
        </ul>
      ) : (
        <Empty>Foydalanuvchi yo‘q</Empty>
      )}
      <NewUserForm departments={deptOptions} />
    </>
  );
}

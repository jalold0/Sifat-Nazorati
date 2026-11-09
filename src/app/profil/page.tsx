import type { Metadata } from 'next';
import Link from 'next/link';

import { requireActor } from '@/modules/foydalanuvchilar/ui';

import { PasswordForm } from '@/modules/foydalanuvchilar/ui';

import { homePath } from '@/modules/foydalanuvchilar/domain';

export const metadata: Metadata = { title: 'Parolni almashtirish' };
export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const actor = await requireActor({ allowMustChange: true });
  return (
    <main className="mx-auto max-w-[420px] px-4 py-10">
      {actor.mustChange ? null : (
        <Link href={homePath(actor.role)} className="mb-3 inline-flex min-h-[44px] items-center text-meta text-brand hover:underline">
          ← Orqaga
        </Link>
      )}
      <p className="eyebrow mb-2">{actor.name}</p>
      <h1 className="text-stat">Parolni almashtirish</h1>
      <p className="mt-2 text-body text-ink2">
        {actor.mustChange
          ? 'Birinchi kirish: davom etishdan oldin o‘zingizga xos yangi parol qo‘ying.'
          : 'Joriy parolni kiriting va yangisini tanlang.'}
      </p>
      <div className="card mt-5 p-6">
        <PasswordForm />
      </div>
    </main>
  );
}

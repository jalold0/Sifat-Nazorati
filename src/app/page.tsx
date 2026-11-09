import { redirect } from 'next/navigation';

import { requireActor } from '@/modules/foydalanuvchilar/ui';

import { homePath } from '@/modules/foydalanuvchilar/domain';

export default async function Home() {
  const actor = await requireActor();
  redirect(homePath(actor.role));
}

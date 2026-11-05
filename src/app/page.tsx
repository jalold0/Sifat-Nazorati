import { redirect } from 'next/navigation';

import { requireActor } from '@/lib/auth';
import { homePath } from '@/qc/policy';

export default async function Home() {
  const actor = await requireActor();
  redirect(homePath(actor.role));
}

'use server';

import { revalidatePath } from 'next/cache';

import { requireActor } from '@/modules/foydalanuvchilar/ui';
import { closeTask } from '@/server/qc';

export type CloseResult = { ok: true } | { ok: false; error: string };

export async function closeTaskAction(id: string, note: string): Promise<CloseResult> {
  const actor = await requireActor();
  const r = await closeTask(actor, id, note);
  if (!r.ok) return { ok: false, error: r.error };
  for (const path of ['/topshiriqlar', '/panel', '/bolimim']) revalidatePath(path);
  return { ok: true };
}

'use server';

import { revalidatePath } from 'next/cache';

import { requireActor } from '@/modules/foydalanuvchilar/ui';
import { saveReportNote } from '@/server/training';

export async function saveNoteAction(week: string, note: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireActor();
  const r = await saveReportNote(actor, week, note);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/hisobot');
  return { ok: true };
}

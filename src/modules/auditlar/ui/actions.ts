'use server';

import { revalidatePath } from 'next/cache';

import { requireActor } from '@/modules/foydalanuvchilar/ui';

import { closeTask, createAudit, deleteAudit, updateAudit } from '..';

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };
export type CloseResult = { ok: true } | { ok: false; error: string };

function refresh() {
  for (const path of ['/panel', '/tekshiruv', '/tarix', '/topshiriqlar', '/bolimim']) revalidatePath(path);
}

/** Yangi tekshiruv + topshiriqlar bitta amalda. Ruxsat va qoidalar serverda tekshiriladi. */
export async function saveAuditAction(body: unknown): Promise<SaveResult> {
  const actor = await requireActor();
  const r = await createAudit(actor, body);
  if (!r.ok) return { ok: false, error: r.error };
  refresh();
  return { ok: true, id: r.data.id };
}

export async function updateAuditAction(id: string, body: unknown): Promise<SaveResult> {
  const actor = await requireActor();
  const r = await updateAudit(actor, id, body);
  if (!r.ok) return { ok: false, error: r.error };
  refresh();
  return { ok: true, id: r.data.id };
}

export async function deleteAuditAction(id: string): Promise<SaveResult> {
  const actor = await requireActor();
  const r = await deleteAudit(actor, id);
  if (!r.ok) return { ok: false, error: r.error };
  refresh();
  return { ok: true, id: r.data.id };
}

export async function closeTaskAction(id: string, note: string): Promise<CloseResult> {
  const actor = await requireActor();
  const r = await closeTask(actor, id, note);
  if (!r.ok) return { ok: false, error: r.error };
  for (const path of ['/topshiriqlar', '/panel', '/bolimim']) revalidatePath(path);
  return { ok: true };
}

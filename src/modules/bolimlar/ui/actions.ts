'use server';

import { revalidatePath } from 'next/cache';

import { requireActor } from '@/modules/foydalanuvchilar/ui';

import { moveDepartment, saveDepartment, type SaveDepartmentInput } from '..';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function refresh() {
  for (const path of ['/sozlamalar', '/panel', '/tekshiruv', '/bolimim']) revalidatePath(path);
}

export async function saveDepartmentAction(input: SaveDepartmentInput): Promise<ActionResult> {
  const actor = await requireActor();
  const r = await saveDepartment(actor, input);
  if (!r.ok) return { ok: false, error: r.error };
  refresh();
  return { ok: true, id: r.data.id };
}

export async function moveDepartmentAction(id: string, dir: -1 | 1): Promise<ActionResult> {
  const actor = await requireActor();
  const r = await moveDepartment(actor, id, dir);
  if (!r.ok) return { ok: false, error: r.error };
  refresh();
  return { ok: true };
}


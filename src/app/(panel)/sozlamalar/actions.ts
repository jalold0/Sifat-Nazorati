'use server';

import { revalidatePath } from 'next/cache';

import { requireActor } from '@/lib/auth';
import { moveDepartment, saveDepartment, type DeptInput } from '@/server/qc';
import { saveUser, type UserInput } from '@/server/users';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function refresh() {
  for (const path of ['/sozlamalar', '/panel', '/tekshiruv', '/bolimim']) revalidatePath(path);
}

export async function saveDepartmentAction(input: DeptInput): Promise<ActionResult> {
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

export async function saveUserAction(input: UserInput): Promise<ActionResult> {
  const actor = await requireActor();
  const r = await saveUser(actor, input);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/sozlamalar/foydalanuvchilar');
  return { ok: true, id: r.data.id };
}

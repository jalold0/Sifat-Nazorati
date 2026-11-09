'use server';

import { revalidatePath } from 'next/cache';

import { requireActor } from '@/modules/foydalanuvchilar/ui';
import { setTask, submitTest, type SubmitResult } from '..';

export type TaskResult = { ok: true } | { ok: false; error: string };
export type SubmitActionResult = ({ ok: true } & SubmitResult) | { ok: false; error: string; status: number };

function refresh() {
  for (const path of ['/oquv', '/natijalar']) revalidatePath(path);
}

/** Foydalanuvchi faqat O'Z yozuviga yozadi: uid sessiyadan olinadi, so'rovdan emas. */
export async function setTaskAction(deptId: string, key: string, done: boolean): Promise<TaskResult> {
  const actor = await requireActor();
  const r = await setTask(actor, deptId, key, done);
  if (!r.ok) return { ok: false, error: r.error };
  refresh();
  return { ok: true };
}

export async function submitTestAction(deptId: string, answers: unknown): Promise<SubmitActionResult> {
  const actor = await requireActor();
  const r = await submitTest(actor, deptId, answers);
  if (!r.ok) return { ok: false, error: r.error, status: r.status };
  refresh();
  return { ok: true, ...r.data };
}

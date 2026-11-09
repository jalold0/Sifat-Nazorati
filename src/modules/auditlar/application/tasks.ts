import { canEditTask, canReadDept, deptScope } from '@/modules/foydalanuvchilar/domain';
import type { Actor } from '@/shared/actor';
import { bad, forbidden, notFound, ok, type Res } from '@/shared/result';
import { isYmd, todayTashkent } from '@/shared/time';

import type { TaskDto, TaskQuery, TaskTab } from '../domain';

import type { AuditDeps } from './ports';

const NO_ACCESS = 'Bu bo‘limni ko‘rishga ruxsatingiz yo‘q.';

export async function listTasks(deps: AuditDeps, actor: Actor, q: TaskQuery): Promise<Res<TaskDto[]>> {
  if (q.dept && !canReadDept(actor, q.dept)) return forbidden(NO_ACCESS);
  if (q.dueBefore && !isYmd(q.dueBefore)) return bad('Sana noto‘g‘ri: YYYY-MM-DD ko‘rinishida kiriting.');
  const rows = await deps.tasks().list({
    deptId: q.dept ?? deptScope(actor) ?? undefined,
    status: q.status,
    dueBefore: q.dueBefore,
  });
  return ok(rows);
}

/**
 * Topshiriqlar sahifasi: tanlangan varaq bazada filtrlanadi va 50 tadan sahifalanadi, sonlar `count()` bilan
 * olinadi — topshiriqlar ko'paysa ham hech biri ro'yxatdan jim tushib qolmaydi.
 * Muddati o'tgan va ochiq — muddat bo'yicha (eng shoshilinchi birinchi); yopilgan — eng oxirgi yopilgani birinchi.
 */
export async function listTaskTab(
  deps: AuditDeps,
  actor: Actor,
  q: { tab: TaskTab; dept?: string; offset?: number },
): Promise<Res<{ rows: TaskDto[]; total: number; counts: Record<TaskTab, number> }>> {
  if (q.dept && !canReadDept(actor, q.dept)) return forbidden(NO_ACCESS);
  return ok(
    await deps.tasks().tab({
      tab: q.tab,
      deptId: q.dept ?? deptScope(actor) ?? undefined,
      today: todayTashkent(deps.now()),
      offset: Math.max(q.offset ?? 0, 0),
    }),
  );
}

/** «Qayta tekshirdim»: izoh majburiy, topshiriq yopiladi. */
export async function closeTask(deps: AuditDeps, actor: Actor, id: string, note: unknown): Promise<Res<{ id: string }>> {
  if (!canEditTask(actor)) return forbidden('Topshiriqni yopish huquqingiz yo‘q.');
  const text = typeof note === 'string' ? note.trim() : '';
  if (!text) return bad('Qayta tekshirish izohini yozing: nima tekshirilganini qisqa ko‘rsating.');
  const row = await deps.tasks().find(id);
  if (!row) return notFound('Topshiriq topilmadi.');
  if (row.status === 'closed') return bad('Bu topshiriq allaqachon yopilgan.');
  await deps.tasks().close(id, { byId: actor.id, on: todayTashkent(deps.now()), note: text });
  return ok({ id });
}

export async function updateTask(
  deps: AuditDeps,
  actor: Actor,
  id: string,
  body: { what?: unknown; owner?: unknown; due?: unknown },
): Promise<Res<{ id: string }>> {
  if (!canEditTask(actor)) return forbidden('Topshiriqni tahrirlash huquqingiz yo‘q.');
  const row = await deps.tasks().find(id);
  if (!row) return notFound('Topshiriq topilmadi.');
  const what = typeof body.what === 'string' ? body.what.trim() : row.what;
  const owner = typeof body.owner === 'string' ? body.owner.trim() : row.owner;
  const due = typeof body.due === 'string' ? body.due.trim() : row.due;
  if (!what) return bad('«Nima qilinishi kerak» maydonini to‘ldiring.');
  if (!owner) return bad('Mas‘ul shaxsni yozing.');
  if (!isYmd(due)) return bad('Muddat noto‘g‘ri: sanani tanlang.');

  const lines: string[] = [];
  if (what !== row.what) lines.push(`nima: «${what}»`);
  if (owner !== row.owner) lines.push(`mas‘ul: ${row.owner} → ${owner}`);
  if (due !== row.due) lines.push(`muddat: ${row.due} → ${due}`);
  await deps.uow.run(async (tx) => {
    await deps.tasks(tx).update(id, { what, owner, due });
    if (lines.length > 0) {
      await deps.journal(tx).write({
        actorId: actor.id,
        action: 'task.update',
        entity: 'QcTask',
        entityId: id,
        summary: `Topshiriq tahrirlandi: ${lines.join('; ')}`,
      });
    }
  });
  return ok({ id });
}

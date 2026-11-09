import { canManageDepartments, deptScope } from '@/modules/foydalanuvchilar/domain';
import type { Actor } from '@/shared/actor';
import { bad, forbidden, notFound, ok, type Res } from '@/shared/result';

import {
  diffDept,
  nextCheckpointNumber,
  normalizeCheckpoint,
  validateDepartmentInput,
  type DeptDto,
  type SaveDepartmentInput,
} from '../domain';

import type { DepartmentDeps, DeptSavePlan } from './ports';

/** Bo'limlar va nuqtalar. Ko'ruvchi/supervayzer faqat o'z bo'limini oladi. Nofaol bo'limlar faqat so'ralganda. */
export function listDepartments(
  deps: DepartmentDeps,
  actor: Actor,
  opts: { includeInactive?: boolean } = {},
): Promise<DeptDto[]> {
  return deps.departments().list({ scope: deptScope(actor), includeInactive: !!opts.includeInactive });
}

/** Bitta bo'lim (ruxsat tekshirmaydi — chaqiruvchi modul o'zi tekshiradi). */
export function findDepartment(deps: DepartmentDeps, id: string): Promise<DeptDto | null> {
  return deps.departments().get(id);
}

/**
 * Bo'lim yaratish/o'zgartirish (faqat rahbar). Nuqtalar O'CHIRILMAYDI — faqat `active:false` qilinadi;
 * yangi nuqtaga bo'lim ichida keyingi `cpN` id beriladi. Massivdagi tartib — nuqtalar tartibi.
 * O'zgarish jurnalga shu tranzaksiyada yoziladi.
 */
export async function saveDepartment(deps: DepartmentDeps, actor: Actor, input: SaveDepartmentInput): Promise<Res<{ id: string }>> {
  if (!canManageDepartments(actor)) return forbidden('Bo‘limlarni faqat rahbar o‘zgartira oladi.');
  const v = validateDepartmentInput(input);
  if (!v.ok) return bad(v.error);

  const repo = deps.departments();
  if (await repo.nameTaken(v.name, input.id)) return bad('Bunday nomli bo‘lim allaqachon bor. Boshqa nom tanlang.');

  const existing = input.id ? await repo.get(input.id) : null;
  if (input.id && !existing) return notFound('Bo‘lim topilmadi.');

  const knownCp = new Set((existing?.checkpoints ?? []).map((c) => c.id));
  for (const c of input.checkpoints) {
    if (c.id && !knownCp.has(c.id)) return bad('Nuqta topilmadi. Sahifani yangilang.');
  }
  const knownStaff = new Set((existing?.staff ?? []).map((s) => s.id));
  for (const s of input.staff ?? []) {
    if (s.id && !knownStaff.has(s.id)) return bad('Hodim topilmadi. Sahifani yangilang.');
  }
  const activeStaff = input.staff ? input.staff.filter((s) => s.active).length : (existing?.staff ?? []).filter((s) => s.active).length;
  if (v.hasStaffCheckpoint && activeStaff === 0) {
    return bad('Hodimlar kesimidagi nuqta bor, lekin bo‘limda faol hodim yo‘q. Avval hodimlarni qo‘shing.');
  }

  const after = {
    ...input,
    name: v.name,
    checkpoints: input.checkpoints.map(normalizeCheckpoint),
    staff: input.staff?.map((s) => ({ ...s, name: s.name.trim(), role: (s.role ?? '').trim() })),
  };
  const lines = diffDept(existing, after);

  // Yangi nuqtalarga keyingi cpN id beriladi
  let next = nextCheckpointNumber((existing?.checkpoints ?? []).map((c) => c.id));
  const plan: DeptSavePlan = {
    id: existing?.id,
    name: v.name,
    norm: input.norm,
    estimate: input.estimate,
    active: input.active,
    position: existing ? undefined : (await repo.nextPosition()),
    checkpoints: after.checkpoints.map((c) => {
      const isNew = !c.id;
      return {
        id: c.id ?? `cp${++next}`,
        isNew,
        text: c.text,
        group: c.group?.trim() || null,
        weight: c.weight,
        critical: c.critical,
        active: c.active,
        kind: c.kind,
        okLabel: c.okLabel,
        badLabel: c.badLabel,
        list: c.list,
      };
    }),
    staff: after.staff?.map((s) => ({ id: s.id, name: s.name, role: s.role, active: s.active })),
  };

  const id = await deps.uow.run(async (tx) => {
    const deptId = await deps.departments(tx).save(plan);
    if (lines.length > 0) {
      await deps.journal(tx).write({
        actorId: actor.id,
        action: 'dept.save',
        entity: 'QcDepartment',
        entityId: deptId,
        summary: `${v.name}: ${lines.join('; ')}`,
      });
    }
    return deptId;
  });
  return ok({ id });
}

/** Bo'lim tartibini o'zgartirish (panelda ko'rinish tartibi). */
export async function moveDepartment(deps: DepartmentDeps, actor: Actor, id: string, dir: -1 | 1): Promise<Res<{ id: string }>> {
  if (!canManageDepartments(actor)) return forbidden('Bo‘limlarni faqat rahbar o‘zgartira oladi.');
  const all = await deps.departments().order();
  const i = all.findIndex((d) => d.id === id);
  if (i < 0) return notFound('Bo‘lim topilmadi.');
  const j = i + dir;
  if (j < 0 || j >= all.length) return ok({ id });

  const order = all.map((d) => d.id);
  [order[i], order[j]] = [order[j] as string, order[i] as string];
  await deps.uow.run(async (tx) => {
    await deps.departments(tx).setOrder(order);
    await deps.journal(tx).write({
      actorId: actor.id,
      action: 'dept.move',
      entity: 'QcDepartment',
      entityId: id,
      summary: `Bo‘lim tartibi o‘zgardi: «${all[i]?.name ?? ''}» ${dir < 0 ? 'yuqoriga' : 'pastga'}`,
    });
  });
  return ok({ id });
}

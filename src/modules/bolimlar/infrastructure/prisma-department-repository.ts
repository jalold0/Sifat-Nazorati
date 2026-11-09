import type { Prisma, PrismaClient } from '@prisma/client';

import { KIND_FROM_DB, KIND_TO_DB, LIST_FROM_DB, LIST_TO_DB } from '@/shared/infrastructure/enums';
import { dbOf } from '@/shared/infrastructure/prisma';
import type { Tx } from '@/shared/unit-of-work';

import type { DeptDto } from '../domain';
import type { DepartmentRepository } from '../application/ports';

/** Bo'lim + nuqtalar + hodimlar — DeptDto uchun yagona `include`. */
const DEPT_INCLUDE = { checkpoints: true, staff: true } satisfies Prisma.QcDepartmentInclude;
type DeptRow = Prisma.QcDepartmentGetPayload<{ include: typeof DEPT_INCLUDE }>;

export function toDept(d: DeptRow): DeptDto {
  return {
    id: d.id,
    name: d.name,
    position: d.position,
    active: d.active,
    norm: d.norm,
    estimate: d.estimate,
    checkpoints: [...d.checkpoints]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        text: c.text,
        group: c.grp,
        weight: c.weight,
        critical: c.critical,
        active: c.active,
        kind: KIND_FROM_DB[c.kind],
        okLabel: c.okLabel,
        badLabel: c.badLabel,
        list: LIST_FROM_DB[c.list],
      })),
    staff: [...d.staff]
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      .map((s) => ({ id: s.id, name: s.name, role: s.role, active: s.active })),
  };
}

export function prismaDepartmentRepository(client: PrismaClient, tx?: Tx): DepartmentRepository {
  const db = dbOf(client, tx);
  return {
    async list({ scope, includeInactive }) {
      const rows = await db.qcDepartment.findMany({
        where: { ...(includeInactive ? {} : { active: true }), ...(scope ? { id: scope } : {}) },
        include: DEPT_INCLUDE,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      });
      return rows.map(toDept);
    },

    async get(id) {
      const row = await db.qcDepartment.findUnique({ where: { id }, include: DEPT_INCLUDE });
      return row ? toDept(row) : null;
    },

    async nameTaken(name, exceptId) {
      const dupe = await db.qcDepartment.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        select: { id: true },
      });
      return !!dupe;
    },

    async nextPosition() {
      const max = await db.qcDepartment.aggregate({ _max: { position: true } });
      return (max._max.position ?? 0) + 1;
    },

    async save(plan) {
      const base = { name: plan.name, norm: plan.norm, estimate: plan.estimate, active: plan.active };
      let deptId: string;
      if (plan.id) {
        await db.qcDepartment.update({ where: { id: plan.id }, data: base });
        deptId = plan.id;
      } else {
        const created = await db.qcDepartment.create({ data: { ...base, position: plan.position ?? 1 } });
        deptId = created.id;
      }
      for (const [i, c] of plan.checkpoints.entries()) {
        const data = {
          text: c.text,
          grp: c.group,
          weight: c.weight,
          critical: c.critical,
          active: c.active,
          position: i + 1,
          kind: KIND_TO_DB[c.kind],
          okLabel: c.okLabel,
          badLabel: c.badLabel,
          list: LIST_TO_DB[c.list],
        };
        if (c.isNew) await db.qcCheckpoint.create({ data: { ...data, deptId, id: c.id } });
        else await db.qcCheckpoint.update({ where: { deptId_id: { deptId, id: c.id } }, data });
      }
      // Hodimlar: tartib — massivdagi tartib; o'chirilmaydi, faqat yashiriladi
      for (const [i, s] of (plan.staff ?? []).entries()) {
        const data = { name: s.name, role: s.role, active: s.active, position: i + 1 };
        if (s.id) await db.qcStaff.update({ where: { id: s.id }, data });
        else await db.qcStaff.create({ data: { ...data, deptId } });
      }
      return deptId;
    },

    order() {
      return db.qcDepartment.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true, name: true } });
    },

    async setOrder(ids) {
      for (const [idx, id] of ids.entries()) {
        await db.qcDepartment.update({ where: { id }, data: { position: idx + 1 } });
      }
    },
  };
}

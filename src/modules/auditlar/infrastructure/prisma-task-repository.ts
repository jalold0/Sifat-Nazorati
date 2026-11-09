import type { Prisma, PrismaClient } from '@prisma/client';

import { dbOf } from '@/shared/infrastructure/prisma';
import { todayTashkent } from '@/shared/time';
import type { Tx } from '@/shared/unit-of-work';

import { PAGE_SIZE, type TaskDto, type TaskTab } from '../domain';
import type { TaskRepository } from '../application/ports';

const WITH_CHECKER = { checkedBy: { select: { shortName: true } } } satisfies Prisma.QcTaskInclude;
type TaskRow = Prisma.QcTaskGetPayload<{ include: typeof WITH_CHECKER }>;

function toTask(t: TaskRow): TaskDto {
  return {
    id: t.id,
    audit: t.auditId,
    dept: t.deptId,
    cp: t.cpId,
    what: t.what,
    owner: t.owner,
    due: t.due,
    status: t.status === 'OPEN' ? 'open' : 'closed',
    closedAt: t.checkedOn,
    checkNote: t.checkNote,
    checkedByName: t.checkedBy?.shortName ?? null,
  };
}

export function prismaTaskRepository(client: PrismaClient, tx?: Tx): TaskRepository {
  const db = dbOf(client, tx);
  return {
    async list(f) {
      const rows = await db.qcTask.findMany({
        where: {
          ...(f.deptId ? { deptId: f.deptId } : {}),
          ...(f.status ? { status: f.status === 'open' ? 'OPEN' : 'CLOSED' } : {}),
          ...(f.dueBefore ? { due: { lt: f.dueBefore } } : {}),
        },
        include: WITH_CHECKER,
        orderBy: [{ due: 'asc' }, { createdAt: 'asc' }],
      });
      return rows.map(toTask);
    },

    async ofAudit(auditId) {
      const rows = await db.qcTask.findMany({ where: { auditId }, include: WITH_CHECKER, orderBy: { createdAt: 'asc' } });
      return rows.map(toTask);
    },

    async tab({ tab, deptId, today, offset }) {
      const base: Prisma.QcTaskWhereInput = deptId ? { deptId } : {};
      const where: Record<TaskTab, Prisma.QcTaskWhereInput> = {
        overdue: { ...base, status: 'OPEN', due: { lt: today } },
        open: { ...base, status: 'OPEN' },
        closed: { ...base, status: 'CLOSED' },
      };
      const orderBy: Prisma.QcTaskOrderByWithRelationInput[] =
        tab === 'closed' ? [{ checkedOn: 'desc' }, { updatedAt: 'desc' }] : [{ due: 'asc' }, { createdAt: 'asc' }];
      const [rows, overdue, open, closed] = await Promise.all([
        db.qcTask.findMany({ where: where[tab], include: WITH_CHECKER, orderBy, take: PAGE_SIZE, skip: offset }),
        db.qcTask.count({ where: where.overdue }),
        db.qcTask.count({ where: where.open }),
        db.qcTask.count({ where: where.closed }),
      ]);
      const counts = { overdue, open, closed };
      return { rows: rows.map(toTask), total: counts[tab], counts };
    },

    async find(id) {
      const row = await db.qcTask.findUnique({ where: { id }, include: WITH_CHECKER });
      return row ? toTask(row) : null;
    },

    async close(id, c) {
      await db.qcTask.update({ where: { id }, data: { status: 'CLOSED', checkedById: c.byId, checkedOn: c.on, checkNote: c.note } });
    },

    async update(id, c) {
      await db.qcTask.update({ where: { id }, data: c });
    },

    async createMany(auditId, deptId, tasks) {
      await db.qcTask.createMany({
        data: tasks.map((t) => ({ auditId, deptId, cpId: t.cp, what: t.what, owner: t.owner, due: t.due })),
      });
    },

    async deleteOpen(auditId) {
      await db.qcTask.deleteMany({ where: { auditId, status: 'OPEN' } });
    },

    async checkpointsWithTasks(auditId) {
      const rows = await db.qcTask.findMany({ where: { auditId }, select: { cpId: true } });
      return rows.map((t) => t.cpId);
    },

    async forSummary(deptIds, from) {
      const rows = await db.qcTask.findMany({
        where: { deptId: { in: deptIds }, OR: [{ due: { gte: from } }, { status: 'OPEN' }, { checkedOn: { gte: from } }] },
        select: { id: true, auditId: true, deptId: true, cpId: true, what: true, owner: true, due: true, status: true, checkedOn: true, createdAt: true },
      });
      return rows.map((t) => ({
        id: t.id,
        audit: t.auditId,
        dept: t.deptId,
        cp: t.cpId,
        what: t.what,
        owner: t.owner,
        due: t.due,
        status: t.status === 'OPEN' ? ('open' as const) : ('closed' as const),
        closedAt: t.checkedOn,
        createdOn: todayTashkent(t.createdAt),
      }));
    },
  };
}

import { Prisma, type PrismaClient } from '@prisma/client';

import { LIST_FROM_DB, LIST_TO_DB } from '@/shared/infrastructure/enums';
import { dbOf } from '@/shared/infrastructure/prisma';
import type { Tx } from '@/shared/unit-of-work';

import type { Answer, StaffBlock } from '../domain';
import type { AuditRecord, AuditRepository } from '../application/ports';

/** Tekshiruv + kiritgan + baholangan operator. */
const AUDIT_INCLUDE = {
  by: { select: { shortName: true } },
  staffRef: { select: { name: true } },
} satisfies Prisma.QcAuditInclude;
type AuditRow = Prisma.QcAuditGetPayload<{ include: typeof AUDIT_INCLUDE }>;

/** Json ustunidan o'qilgan hodimlar bloki (eski yozuvda null). */
const staffOf = (v: Prisma.JsonValue | null): StaffBlock | null => (v && typeof v === 'object' ? (v as unknown as StaffBlock) : null);
/** Json ustuniga yozish: null — bazada NULL. */
const staffJson = (b: StaffBlock | null) => (b ? (b as unknown as Prisma.InputJsonValue) : Prisma.DbNull);

function toRecord(a: AuditRow): AuditRecord {
  return {
    id: a.id,
    deptId: a.deptId,
    date: a.date,
    byId: a.byId,
    byName: a.by.shortName,
    subject: a.subject,
    answers: a.answers as Record<string, Answer>,
    notes: a.notes as AuditRecord['notes'],
    critical: a.critical,
    weights: a.weights as Record<string, number> | null,
    staff: staffOf(a.staff),
    list: LIST_FROM_DB[a.list],
    staffId: a.staffId,
    staffName: a.staffRef?.name ?? null,
    channel: a.channel,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export function prismaAuditRepository(client: PrismaClient, tx?: Tx): AuditRepository {
  const db = dbOf(client, tx);
  return {
    async list(filter, page) {
      const where: Prisma.QcAuditWhereInput = {
        ...(filter.deptId ? { deptId: filter.deptId } : {}),
        ...(filter.from || filter.to
          ? { date: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
          : {}),
        ...(filter.list ? { list: LIST_TO_DB[filter.list] } : {}),
      };
      const [rows, total] = await Promise.all([
        db.qcAudit.findMany({
          where,
          include: AUDIT_INCLUDE,
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: page.take,
          skip: page.skip,
        }),
        db.qcAudit.count({ where }),
      ]);
      return { rows: rows.map(toRecord), total };
    },

    async get(id) {
      const row = await db.qcAudit.findUnique({ where: { id }, include: AUDIT_INCLUDE });
      return row ? toRecord(row) : null;
    },

    async create(a) {
      const created = await db.qcAudit.create({
        data: {
          deptId: a.deptId,
          date: a.date,
          byId: a.byId,
          answers: a.answers,
          notes: a.notes,
          subject: a.subject,
          staff: staffJson(a.staff),
          list: LIST_TO_DB[a.list],
          staffId: a.staffId,
          channel: a.channel,
          critical: a.critical,
          weights: a.weights,
        },
        select: { id: true },
      });
      return created.id;
    },

    async update(id, c) {
      await db.qcAudit.update({
        where: { id },
        data: {
          date: c.date,
          answers: c.answers,
          notes: c.notes,
          subject: c.subject,
          staff: staffJson(c.staff),
          staffId: c.staffId,
          channel: c.channel,
          critical: c.critical,
          weights: c.weights,
        },
      });
    },

    async delete(id) {
      await db.qcAudit.delete({ where: { id } });
    },

    async inRange(deptIds, from, to) {
      const rows = await db.qcAudit.findMany({
        where: { deptId: { in: deptIds }, date: { gte: from, lte: to } },
        select: { id: true, deptId: true, date: true, answers: true, critical: true, weights: true, staff: true, list: true, staffId: true, channel: true },
      });
      return rows.map((a) => ({
        id: a.id,
        dept: a.deptId,
        date: a.date,
        answers: a.answers as Record<string, Answer>,
        critical: a.critical,
        weights: a.weights as Record<string, number> | null,
        staff: staffOf(a.staff),
        list: LIST_FROM_DB[a.list],
        staffId: a.staffId,
        channel: a.channel,
      }));
    },
  };
}

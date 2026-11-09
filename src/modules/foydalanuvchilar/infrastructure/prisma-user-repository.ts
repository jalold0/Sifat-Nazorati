import type { PrismaClient } from '@prisma/client';

import type { QcRole } from '@/shared/actor';
import { dbOf } from '@/shared/infrastructure/prisma';
import type { Tx } from '@/shared/unit-of-work';

import type { StoredUser, UserRepository } from '../application/ports';

export function prismaUserRepository(client: PrismaClient, tx?: Tx): UserRepository {
  const db = dbOf(client, tx);
  const toStored = (u: NonNullable<Awaited<ReturnType<typeof db.user.findUnique>>>): StoredUser => ({
    id: u.id,
    key: u.key,
    login: u.login,
    fullName: u.fullName,
    shortName: u.shortName,
    role: u.role as QcRole,
    deptId: u.deptId,
    active: u.active,
    passwordHash: u.passwordHash,
    mustChangePassword: u.mustChangePassword,
    sessionVersion: u.sessionVersion,
  });

  return {
    async findByLogin(login) {
      const u = await db.user.findUnique({ where: { login } });
      return u ? toStored(u) : null;
    },
    async findById(id) {
      const u = await db.user.findUnique({ where: { id } });
      return u ? toStored(u) : null;
    },
    async list() {
      const rows = await db.user.findMany({
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
        select: { id: true, login: true, fullName: true, role: true, deptId: true, active: true },
      });
      return rows.map((u) => ({ ...u, role: u.role as QcRole }));
    },
    async departmentExists(id) {
      return (await db.qcDepartment.findUnique({ where: { id }, select: { id: true } })) !== null;
    },
    async create(data) {
      const created = await db.user.create({ data, select: { id: true } });
      return created.id;
    },
    async update(id, patch) {
      const { revokeSessions, ...rest } = patch;
      await db.user.update({
        where: { id },
        data: { ...rest, ...(revokeSessions ? { sessionVersion: { increment: 1 } } : {}) },
      });
    },
    async recordLogin(id, at) {
      await db.user.update({ where: { id }, data: { lastLoginAt: at } });
    },
  };
}

import type { Prisma, PrismaClient } from '@prisma/client';

import { dbOf } from '@/shared/infrastructure/prisma';

import type { Day, Question } from '../domain';
import type { ProgramRecord, TrainingRepository } from '../application/ports';

const WITH_DEPT = { dept: { select: { name: true, position: true } } } satisfies Prisma.QcTrainingInclude;
type ProgramRow = Prisma.QcTrainingGetPayload<{ include: typeof WITH_DEPT }>;

function toProgram(t: ProgramRow): ProgramRecord {
  return {
    deptId: t.deptId,
    deptName: t.dept.name,
    deptPosition: t.dept.position,
    title: t.title,
    intro: t.intro,
    passPct: t.passPct,
    days: t.days as unknown as Day[],
    questions: t.questions as unknown as Question[],
  };
}

export function prismaTrainingRepository(client: PrismaClient): TrainingRepository {
  const db = dbOf(client);
  return {
    async programs({ activeOnly }) {
      const rows = await db.qcTraining.findMany({ where: activeOnly ? { dept: { active: true } } : {}, include: WITH_DEPT });
      return rows.map(toProgram);
    },

    async program(deptId) {
      const row = await db.qcTraining.findUnique({ where: { deptId }, include: WITH_DEPT });
      return row ? toProgram(row) : null;
    },

    doneTasks(filter) {
      return db.qcTrainingTask.findMany({
        where: filter,
        select: { userId: true, deptId: true, key: true },
      });
    },

    attemptSummaries(userId) {
      return db.qcTrainingAttempt.findMany({ where: { userId }, select: { deptId: true, at: true, pct: true, passed: true } });
    },

    async allAttempts() {
      const rows = await db.qcTrainingAttempt.findMany({ orderBy: { at: 'asc' } });
      return rows.map((a) => ({
        id: a.id,
        userId: a.userId,
        deptId: a.deptId,
        at: a.at,
        score: a.score,
        total: a.total,
        pct: a.pct,
        passed: a.passed,
        answers: a.answers as Record<string, number>,
      }));
    },

    async addAttempt(a) {
      await db.qcTrainingAttempt.create({
        data: {
          userId: a.userId,
          deptId: a.deptId,
          score: a.score,
          total: a.total,
          pct: a.pct,
          passed: a.passed,
          answers: a.answers as Prisma.InputJsonObject,
        },
      });
    },

    async markTask(userId, deptId, key, done) {
      if (done) {
        await db.qcTrainingTask.upsert({
          where: { userId_deptId_key: { userId, deptId, key } },
          create: { userId, deptId, key },
          update: {},
        });
      } else {
        await db.qcTrainingTask.deleteMany({ where: { userId, deptId, key } });
      }
    },
  };
}

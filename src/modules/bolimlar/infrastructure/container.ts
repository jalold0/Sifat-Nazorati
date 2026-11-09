import type { Ctx } from '@/shared/context';
import { prismaJournal } from '@/shared/infrastructure/journal';
import { clientOf, prismaUnitOfWork } from '@/shared/infrastructure/prisma';

import type { DepartmentDeps } from '../application/ports';

import { prismaDepartmentRepository } from './prisma-department-repository';

export function departmentDeps(ctx?: Ctx): DepartmentDeps {
  const client = clientOf(ctx);
  return {
    uow: prismaUnitOfWork(client),
    departments: (tx) => prismaDepartmentRepository(client, tx),
    journal: (tx) => prismaJournal(client, tx),
  };
}

import { findDepartment, listDepartments } from '@/modules/bolimlar';
import { type Ctx, nowOf } from '@/shared/context';
import { prismaJournal } from '@/shared/infrastructure/journal';
import { clientOf, prismaUnitOfWork } from '@/shared/infrastructure/prisma';

import type { AuditDeps } from '../application/ports';

import { prismaAuditRepository } from './prisma-audit-repository';
import { prismaTaskRepository } from './prisma-task-repository';

export function auditDeps(ctx?: Ctx): AuditDeps {
  const client = clientOf(ctx);
  return {
    uow: prismaUnitOfWork(client),
    audits: (tx) => prismaAuditRepository(client, tx),
    tasks: (tx) => prismaTaskRepository(client, tx),
    journal: (tx) => prismaJournal(client, tx),
    // Bo'limlar — `bolimlar` modulining ochiq API'si orqali
    departments: {
      find: (id) => findDepartment(id, ctx),
      list: (actor, opts) => listDepartments(actor, opts, ctx),
    },
    now: () => nowOf(ctx),
  };
}

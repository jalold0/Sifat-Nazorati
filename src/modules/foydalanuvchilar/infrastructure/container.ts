import { createThrottle } from '../domain';
import { prismaJournal } from '@/shared/infrastructure/journal';
import { clientOf, prismaUnitOfWork } from '@/shared/infrastructure/prisma';
import type { Ctx } from '@/shared/context';

import type { LoginGuard, UserDeps } from '../application/ports';

import { bcryptHasher } from './bcrypt-hasher';
import { prismaUserRepository } from './prisma-user-repository';

/** Kirishdagi muvaffaqiyatsiz urinishlar: login bo'yicha 5 ta / 15 daqiqa, manzil bo'yicha 30 ta / 15 daqiqa. */
const g = globalThis as unknown as { __loginGuard?: LoginGuard };
const loginGuard: LoginGuard =
  g.__loginGuard ??
  (g.__loginGuard = {
    login: createThrottle({ max: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 }),
    ip: createThrottle({ max: 30, windowMs: 15 * 60_000, lockMs: 15 * 60_000 }),
  });

export function userDeps(ctx?: Ctx): UserDeps {
  const client = clientOf(ctx);
  return {
    uow: prismaUnitOfWork(client),
    users: (tx) => prismaUserRepository(client, tx),
    journal: (tx) => prismaJournal(client, tx),
    hasher: bcryptHasher,
    guard: loginGuard,
  };
}

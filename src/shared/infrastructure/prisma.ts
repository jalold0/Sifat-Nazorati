/**
 * Prisma bilan ishlash uchun umumiy infratuzilma. Prisma'ni faqat `infrastructure` qatlamlari (va shu papka)
 * biladi: application qatlami `Ctx.db` va `Tx` ni shaffof tutqich sifatida uzatadi, xolos.
 */

import { PrismaClient, type Prisma } from '@prisma/client';

import type { Ctx } from '../context';
import type { Tx, UnitOfWork } from '../unit-of-work';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Baza so'rovlari bajariladigan tutqich: tranzaksiya (`tx`) bo'lsa — o'sha, bo'lmasa — mijoz. */
export type Db = PrismaClient | Prisma.TransactionClient;

export const clientOf = (ctx?: Ctx): PrismaClient => (ctx?.db as PrismaClient | undefined) ?? prisma;

export const dbOf = (client: PrismaClient, tx?: Tx): Db => (tx as unknown as Prisma.TransactionClient | undefined) ?? client;

export function prismaUnitOfWork(client: PrismaClient): UnitOfWork {
  return {
    run: (fn) => client.$transaction(async (t) => fn(t as unknown as Tx)),
  };
}

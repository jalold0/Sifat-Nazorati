/**
 * Modul `foydalanuvchilar` — kirish, sessiya, parol, rollar va foydalanuvchi boshqaruvi. OCHIQ API (server).
 *
 *   import { ... } from '@/modules/foydalanuvchilar'         — use-case'lar (faqat server)
 *   import { ... } from '@/modules/foydalanuvchilar/domain'  — sof qoidalar (policy, parol, navigatsiya)
 *   import { ... } from '@/modules/foydalanuvchilar/ui'      — komponentlar, himoya (guard) va server action'lar
 *   import { ... } from '@/modules/foydalanuvchilar/edge'    — faqat middleware uchun (Edge: bazasiz)
 */

import type { Actor } from '@/shared/actor';
import type { Ctx } from '@/shared/context';

import { changePassword as changePasswordUseCase } from './application/change-password';
import { login as loginUseCase } from './application/login';
import { listReviewers as listReviewersUseCase, listUsers as listUsersUseCase, saveUser as saveUserUseCase } from './application/manage-users';
import type { UserInput } from './application/ports';
import { currentClaims as currentClaimsUseCase, resolveActor as resolveActorUseCase, revokeSessions as revokeSessionsUseCase } from './application/resolve-actor';
import type { SessionClaims } from './domain';
import { userDeps } from './infrastructure/container';

export type { LoginOutcome } from './application/login';
export type { UserDto, UserInput } from './application/ports';

export const login = (input: { login: string; password: string; ip: string | null; now: number }, ctx?: Ctx) =>
  loginUseCase(userDeps(ctx), input);

export const resolveActor = (claims: SessionClaims, ctx?: Ctx) => resolveActorUseCase(userDeps(ctx), claims);

export const currentClaims = (userId: string, ctx?: Ctx) => currentClaimsUseCase(userDeps(ctx), userId);

export const revokeSessions = (userId: string, ctx?: Ctx) => revokeSessionsUseCase(userDeps(ctx), userId);

export const changePassword = (
  userId: string,
  input: { current: unknown; next: unknown; confirm: unknown },
  ctx?: Ctx,
) => changePasswordUseCase(userDeps(ctx), userId, input);

export const listUsers = (actor: Actor, ctx?: Ctx) => listUsersUseCase(userDeps(ctx), actor);

export const listReviewers = (ctx?: Ctx) => listReviewersUseCase(userDeps(ctx));

export const saveUser = (actor: Actor, input: UserInput, ctx?: Ctx) => saveUserUseCase(userDeps(ctx), actor, input);

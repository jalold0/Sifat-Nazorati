/**
 * Modul `auditlar` — tekshiruvlar (cheklist javoblari, ball) va ulardan chiqqan topshiriqlar.
 * Ochiq API: use-case'lar (shu fayl), sof domain (`./domain`), UI (`./ui`).
 */

import type { Actor } from '@/shared/actor';
import type { Ctx } from '@/shared/context';

import { createAudit as createAuditUseCase, deleteAudit as deleteAuditUseCase, getAudit as getAuditUseCase, listAudits as listAuditsUseCase, updateAudit as updateAuditUseCase } from './application/audits';
import { getSummaryData as getSummaryDataUseCase } from './application/summary';
import { closeTask as closeTaskUseCase, listTasks as listTasksUseCase, listTaskTab as listTaskTabUseCase, updateTask as updateTaskUseCase } from './application/tasks';
import type { AuditQuery, TaskQuery, TaskTab } from './domain';
import { auditDeps } from './infrastructure/container';

export { PAGE_SIZE } from './domain';
export type { AuditDto, AuditQuery, SummaryData, TaskDto, TaskQuery, TaskTab } from './domain';

export const listAudits = (actor: Actor, q: AuditQuery, ctx?: Ctx) => listAuditsUseCase(auditDeps(ctx), actor, q);
export const getAudit = (actor: Actor, id: string, ctx?: Ctx) => getAuditUseCase(auditDeps(ctx), actor, id);
export const createAudit = (actor: Actor, body: unknown, ctx?: Ctx) => createAuditUseCase(auditDeps(ctx), actor, body);
export const updateAudit = (actor: Actor, id: string, body: unknown, ctx?: Ctx) => updateAuditUseCase(auditDeps(ctx), actor, id, body);
export const deleteAudit = (actor: Actor, id: string, ctx?: Ctx) => deleteAuditUseCase(auditDeps(ctx), actor, id);

export const listTasks = (actor: Actor, q: TaskQuery, ctx?: Ctx) => listTasksUseCase(auditDeps(ctx), actor, q);
export const listTaskTab = (actor: Actor, q: { tab: TaskTab; dept?: string; offset?: number }, ctx?: Ctx) =>
  listTaskTabUseCase(auditDeps(ctx), actor, q);
export const closeTask = (actor: Actor, id: string, note: unknown, ctx?: Ctx) => closeTaskUseCase(auditDeps(ctx), actor, id, note);
export const updateTask = (actor: Actor, id: string, body: { what?: unknown; owner?: unknown; due?: unknown }, ctx?: Ctx) =>
  updateTaskUseCase(auditDeps(ctx), actor, id, body);

/** Hisoblash uchun xom yozuvlar (panel va hisobot). */
export const getSummaryData = (actor: Actor, q: { dept?: string; from: string; to: string }, ctx?: Ctx) =>
  getSummaryDataUseCase(auditDeps(ctx), actor, q);

/**
 * Modul `bolimlar` — bo'limlar, nuqtalar (cheklist savollari) va hodimlar. Sozlamalarni faqat rahbar o'zgartiradi.
 * Ochiq API: use-case'lar (shu fayl), sof domain (`./domain`), UI (`./ui`).
 */

import type { Actor } from '@/shared/actor';
import type { Ctx } from '@/shared/context';

import {
  findDepartment as findDepartmentUseCase,
  listDepartments as listDepartmentsUseCase,
  moveDepartment as moveDepartmentUseCase,
  saveDepartment as saveDepartmentUseCase,
} from './application/departments';
import type { SaveDepartmentInput } from './domain';
import { departmentDeps } from './infrastructure/container';

export type { DeptDto, StaffDto, SaveDepartmentInput } from './domain';

export const listDepartments = (actor: Actor, opts: { includeInactive?: boolean } = {}, ctx?: Ctx) =>
  listDepartmentsUseCase(departmentDeps(ctx), actor, opts);

/** Bitta bo'lim (ruxsat tekshirilmaydi — chaqiruvchi modul o'zi tekshiradi). */
export const findDepartment = (id: string, ctx?: Ctx) => findDepartmentUseCase(departmentDeps(ctx), id);

export const saveDepartment = (actor: Actor, input: SaveDepartmentInput, ctx?: Ctx) =>
  saveDepartmentUseCase(departmentDeps(ctx), actor, input);

export const moveDepartment = (actor: Actor, id: string, dir: -1 | 1, ctx?: Ctx) =>
  moveDepartmentUseCase(departmentDeps(ctx), actor, id, dir);

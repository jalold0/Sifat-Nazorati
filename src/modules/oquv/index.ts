/**
 * Modul `oquv` — bo'limlar bo'yicha o'quv dasturi, test va xodimlar natijalari.
 * Ochiq API: use-case'lar (shu fayl), sof domain (`./domain`), UI (`./ui`).
 */

import type { Actor } from '@/shared/actor';
import type { Ctx } from '@/shared/context';

import { getTest as getTestUseCase, listProgress as listProgressUseCase, listTraining as listTrainingUseCase, setTask as setTaskUseCase, submitTest as submitTestUseCase } from './application/training';
import { trainingDeps } from './infrastructure/container';

export type { AttemptDto, ProgressRow, SubmitResult, TestDto, TrainingDto } from './domain';

export const listTraining = (actor: Actor, ctx?: Ctx) => listTrainingUseCase(trainingDeps(ctx), actor);
export const getTest = (actor: Actor, deptId: string, ctx?: Ctx) => getTestUseCase(trainingDeps(ctx), actor, deptId);
export const submitTest = (actor: Actor, deptId: string, answers: unknown, ctx?: Ctx) =>
  submitTestUseCase(trainingDeps(ctx), actor, deptId, answers);
export const setTask = (actor: Actor, deptId: string, key: unknown, done: unknown, ctx?: Ctx) =>
  setTaskUseCase(trainingDeps(ctx), actor, deptId, key, done);
export const listProgress = (actor: Actor, ctx?: Ctx) => listProgressUseCase(trainingDeps(ctx), actor);

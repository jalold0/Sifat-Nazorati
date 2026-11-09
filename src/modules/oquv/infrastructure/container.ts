import { listReviewers } from '@/modules/foydalanuvchilar';
import type { Ctx } from '@/shared/context';
import { clientOf } from '@/shared/infrastructure/prisma';

import type { TrainingDeps } from '../application/ports';

import { prismaTrainingRepository } from './prisma-training-repository';

export function trainingDeps(ctx?: Ctx): TrainingDeps {
  return {
    training: prismaTrainingRepository(clientOf(ctx)),
    // Xodimlar — `foydalanuvchilar` modulining ochiq API'si orqali
    reviewers: { list: () => listReviewers(ctx) },
  };
}

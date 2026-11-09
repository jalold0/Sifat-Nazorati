/**
 * Domain qiymatlari (kichik harf) ↔ Prisma enum (KATTA HARF) moslashtirish. Faqat infrastructure ishlatadi.
 */

import type { QcCheckpointKind, QcListKind } from '@prisma/client';

import type { ListKind } from '../lists';

export type CheckpointKind = 'check' | 'staff_check' | 'staff_count';

export const KIND_FROM_DB: Record<QcCheckpointKind, CheckpointKind> = {
  CHECK: 'check',
  STAFF_CHECK: 'staff_check',
  STAFF_COUNT: 'staff_count',
};

export const KIND_TO_DB: Record<CheckpointKind, QcCheckpointKind> = {
  check: 'CHECK',
  staff_check: 'STAFF_CHECK',
  staff_count: 'STAFF_COUNT',
};

export const LIST_FROM_DB: Record<QcListKind, ListKind> = { SHIFT: 'shift', INTERACTION: 'interaction', WEEKLY: 'weekly' };

export const LIST_TO_DB: Record<ListKind, QcListKind> = { shift: 'SHIFT', interaction: 'INTERACTION', weekly: 'WEEKLY' };

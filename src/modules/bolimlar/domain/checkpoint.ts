/**
 * Nuqta (checkpoint) va bo'lim kirishi: turlar va yorliqlar.
 */

import type { ListKind } from '@/shared/lists';

export type CheckpointKind = 'check' | 'staff_check' | 'staff_count';

export interface Checkpoint {
  id: string;
  text: string;
  weight: number;
  critical: boolean;
  active: boolean;
  group?: string | null;
  /** Bo'lmasa — 'check' (butun bo'lim uchun Ha/Yo'q). */
  kind?: CheckpointKind;
  okLabel?: string | null;
  badLabel?: string | null;
  /** Qaysi cheklist; bo'lmasa — 'shift'. */
  list?: ListKind;
}

export interface DeptInput {
  id: string;
  name: string;
  norm: number;
  estimate: boolean;
  /** Hamma nuqtalar, nofaollari ham (eski tekshiruvlarda ishlatilgan). */
  checkpoints: Checkpoint[];
}

export const KIND_LABEL: Record<CheckpointKind, string> = {
  check: 'Butun bo‘lim: Ha / Yo‘q',
  staff_check: 'Har hodim: Ha / Yo‘q',
  staff_count: 'Har hodim: son (yaxshi / yomon)',
};

export function isStaffKind(kind: CheckpointKind | undefined | null): kind is 'staff_check' | 'staff_count' {
  return kind === 'staff_check' || kind === 'staff_count';
}

/** Nuqtaning «yaxshi» va «yomon» yorliqlari (bo'sh bo'lsa — turga mos standart). */
export function kindLabels(cp: { kind?: CheckpointKind; okLabel?: string | null; badLabel?: string | null }): {
  ok: string;
  bad: string;
} {
  const def = cp.kind === 'staff_count' ? { ok: 'Yaxshi', bad: 'Yomon' } : { ok: 'Ha', bad: 'Yo‘q' };
  return { ok: cp.okLabel?.trim() || def.ok, bad: cp.badLabel?.trim() || def.bad };
}

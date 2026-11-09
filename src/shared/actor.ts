/**
 * Amaldagi foydalanuvchi (rol va bo'lim) — hamma modul ishlatadigan umumiy tushuncha.
 */

export type QcRole = 'HEAD' | 'INSPECTOR' | 'VIEWER' | 'SUPERVISOR';

export interface Actor {
  id: string;
  role: QcRole;
  /** Ko'ruvchi va supervayzerning bo'limi. */
  deptId?: string | null;
}

export const QC_ROLE_LABEL: Record<QcRole, string> = {
  HEAD: 'Rahbar',
  INSPECTOR: 'Tekshiruvchi',
  SUPERVISOR: 'Supervayzer',
  VIEWER: 'Ko‘ruvchi',
};

/** Bu rolga bo'lim biriktirilishi shart (ko'ruvchi, supervayzer). */
export function roleNeedsDept(role: QcRole): boolean {
  return role === 'VIEWER' || role === 'SUPERVISOR';
}

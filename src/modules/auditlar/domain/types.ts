/**
 * Tekshiruv va topshiriq yozuvlari (hisob uchun oddiy obyektlar).
 */

import type { StaffBlock } from './staff';
import type { ListKind } from '@/shared/lists';

export type Answer = 'yes' | 'no' | 'na';

export interface AuditRec {
  id: string;
  dept: string;
  /** YYYY-MM-DD */
  date: string;
  answers: Record<string, Answer>;
  critical: boolean;
  /** Kiritilgan paytdagi og'irliklar: keyin nuqta og'irligi o'zgarsa ham shu tekshiruv bali o'zgarmaydi. */
  weights?: Record<string, number> | null;
  /** Hodimlar kesimidagi natijalar (src/qc/staff.ts); eski yozuvlarda yo'q. */
  staff?: StaffBlock | null;
  /** Qaysi cheklist; bo'lmasa — 'shift'. */
  list?: ListKind;
  /** Muloqot bahosi: baholangan operator va kanal. */
  staffId?: string | null;
  channel?: string | null;
}

export interface TaskRec {
  id: string;
  audit: string;
  dept: string;
  cp: string;
  what: string;
  owner: string;
  /** YYYY-MM-DD */
  due: string;
  status: 'open' | 'closed';
  /** Yopilgan sana, YYYY-MM-DD */
  closedAt?: string | null;
  /** Yaratilgan sana (Toshkent), YYYY-MM-DD — o'tgan sanaga «ochiq» hisoblash uchun. */
  createdOn?: string | null;
}

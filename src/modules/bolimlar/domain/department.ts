/**
 * Bo'lim o'qish modeli: bo'lim + nuqtalar + hodimlar. Brauzerga ham uzatiladigan oddiy obyekt.
 */

import type { Checkpoint } from './checkpoint';

export interface StaffDto {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

export interface DeptDto {
  id: string;
  name: string;
  position: number;
  active: boolean;
  norm: number;
  estimate: boolean;
  checkpoints: Checkpoint[];
  /** Bo'lim hodimlari (yashirilganlari ham — `active`), tartib bo'yicha. */
  staff: StaffDto[];
}

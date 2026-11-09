import type { QcRole } from '@/shared/actor';

/** Sessiya tokeni ichidagi da'volar (JWT). */
export interface SessionClaims {
  sub: string;
  key: string;
  name: string;
  role: QcRole;
  /** Parolni almashtirish majburiy (middleware shu bo'yicha /profil ga yo'naltiradi; asl tekshiruv bazada). */
  mc?: boolean;
  /** Sessiya versiyasi — har so'rovda bazadagi `User.sessionVersion` bilan solishtiriladi. */
  sv: number;
}

/** Amaldagi foydalanuvchi: Actor + ko'rsatiladigan ism + majburiy parol almashtirish belgisi. */
export interface SessionActor {
  id: string;
  role: QcRole;
  deptId: string | null;
  name: string;
  mustChange: boolean;
}

/**
 * Use-case natijasi va tipli xatolar.
 *
 * Kutilgan xato (tekshiruv, ruxsat, topilmadi, ziddiyat) — `Res` sifatida QAYTARILADI; istisno faqat kutilmagan
 * nosozlik uchun (baza o'chdi va h.k.). `error` har doim o'zbekcha matn: foydalanuvchiga o'zgartirilmasdan
 * ko'rsatiladi (tuzatish yo'li xabarning o'zida).
 */

export type ErrorCode = 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT';

const STATUS = { VALIDATION: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 } as const;

export interface AppError {
  code: ErrorCode;
  /** Foydalanuvchiga ko'rsatiladigan o'zbekcha xabar. */
  message: string;
  /** HTTP holati (route handler'lar uchun). */
  status: (typeof STATUS)[ErrorCode];
}

export type Res<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: AppError['status']; code: ErrorCode };

export const ok = <T>(data: T): Res<T> => ({ ok: true, data });

export function fail(code: ErrorCode, message: string): Res<never> {
  return { ok: false, error: message, status: STATUS[code], code };
}

export const bad = (message: string) => fail('VALIDATION', message);
export const forbidden = (message = 'Bu amalga ruxsatingiz yo‘q.') => fail('FORBIDDEN', message);
export const notFound = (message: string) => fail('NOT_FOUND', message);
export const conflict = (message: string) => fail('CONFLICT', message);

export function toAppError(r: Extract<Res<unknown>, { ok: false }>): AppError {
  return { code: r.code, message: r.error, status: r.status };
}

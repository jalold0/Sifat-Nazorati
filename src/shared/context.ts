/**
 * So'rov konteksti. Use-case'lar vaqtni `Date.now()` dan emas, shu yerdan oladi (testda almashtiriladi).
 * `db` — infratuzilma tutqichi (ma'lumotlar bazasi mijozi): application qatlami uning ichini bilmaydi,
 * faqat infrastructure uni ochadi. Bo'sh bo'lsa — standart mijoz ishlatiladi.
 */
export interface Ctx {
  db?: unknown;
  now?: Date;
}

export const nowOf = (ctx?: Ctx): Date => ctx?.now ?? new Date();

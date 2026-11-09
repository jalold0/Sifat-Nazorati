import bcrypt from 'bcryptjs';

import type { PasswordHasher } from '../application/ports';

const ROUNDS = 12;

/**
 * Login topilmaganda solishtiriladigan HAQIQIY bcrypt hash (xuddi shu rounds bilan): javob vaqti mavjud
 * foydalanuvchinikidek bo'ladi. (Noto'g'ri formatdagi soxta hash bilan bcrypt 0 ms da qaytadi — bu loginni oshkor qiladi.)
 */
let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= bcrypt.hash(`dummy-${crypto.randomUUID()}`, ROUNDS));
void dummyHash(); // oldindan tayyorlanadi: birinchi noma'lum login ham sekinroq bo'lib qolmasin

export const bcryptHasher: PasswordHasher = {
  hash: (plain) => bcrypt.hash(plain, ROUNDS),
  verify: (plain, hash) => bcrypt.compare(plain, hash),
  dummyHash,
};

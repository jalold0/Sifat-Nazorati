/**
 * Hamma faol foydalanuvchiga «keyingi kirishda parolni almashtiring» belgisini qo'yadi.
 * Ishlab chiqarishga o'tishda bir marta ishlatiladi (boshlang'ich parollar umumiy bo'lgani uchun).
 *
 * Ishlatish:  pnpm users:force-password-change
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
db.user
  .updateMany({ where: { active: true }, data: { mustChangePassword: true } })
  .then((r) => console.log(`${r.count} ta foydalanuvchi keyingi kirishda parolni almashtiradi`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

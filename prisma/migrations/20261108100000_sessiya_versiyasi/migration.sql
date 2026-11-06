-- Sessiya versiyasi: oshirilsa foydalanuvchining hamma eski sessiyalari (JWT) bekor bo'ladi.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Cheklistlar: Kunlik smena / Muloqot bahosi / Haftalik tahlil; Supervayzer roli (docs/call-center-cheklist.md).
-- Faqat qo'shimcha: mavjud nuqta va tekshiruvlar «Kunlik smena» (SHIFT) bo'lib qoladi.
-- CreateEnum
CREATE TYPE "QcListKind" AS ENUM ('SHIFT', 'INTERACTION', 'WEEKLY');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERVISOR';

-- AlterTable
ALTER TABLE "QcAudit" ADD COLUMN     "channel" VARCHAR(16),
ADD COLUMN     "list" "QcListKind" NOT NULL DEFAULT 'SHIFT',
ADD COLUMN     "staffId" TEXT;

-- AlterTable
ALTER TABLE "QcCheckpoint" ADD COLUMN     "list" "QcListKind" NOT NULL DEFAULT 'SHIFT';

-- CreateIndex
CREATE INDEX "QcAudit_deptId_list_date_idx" ON "QcAudit"("deptId", "list", "date");

-- CreateIndex
CREATE INDEX "QcAudit_staffId_idx" ON "QcAudit"("staffId");

-- AddForeignKey
ALTER TABLE "QcAudit" ADD CONSTRAINT "QcAudit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "QcStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- 4-bosqich: hodimlar kesimida tekshirish (docs/spec-hodimlar-kesimida.md). Faqat qo'shimcha: mavjud yozuvlar o'zgarmaydi.
-- CreateEnum
CREATE TYPE "QcCheckpointKind" AS ENUM ('CHECK', 'STAFF_CHECK', 'STAFF_COUNT');

-- AlterTable
ALTER TABLE "QcAudit" ADD COLUMN     "staff" JSONB;

-- AlterTable
ALTER TABLE "QcCheckpoint" ADD COLUMN     "badLabel" TEXT,
ADD COLUMN     "kind" "QcCheckpointKind" NOT NULL DEFAULT 'CHECK',
ADD COLUMN     "okLabel" TEXT;

-- CreateTable
CREATE TABLE "QcStaff" (
    "id" TEXT NOT NULL,
    "deptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QcStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QcStaff_deptId_active_idx" ON "QcStaff"("deptId", "active");

-- AddForeignKey
ALTER TABLE "QcStaff" ADD CONSTRAINT "QcStaff_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "QcDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

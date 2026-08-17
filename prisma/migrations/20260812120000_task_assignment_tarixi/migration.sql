-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" SERIAL NOT NULL,
    "taskDefId" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "backupId" TEXT,
    "from" TIMESTAMP(3) NOT NULL,
    "until" TIMESTAMP(3),
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAssignment_taskDefId_until_idx" ON "TaskAssignment"("taskDefId", "until");

-- CreateIndex
CREATE INDEX "TaskAssignment_ownerId_idx" ON "TaskAssignment"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskDefId_from_key" ON "TaskAssignment"("taskDefId", "from");

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskDefId_fkey" FOREIGN KEY ("taskDefId") REFERENCES "TaskDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: mavjud vazifalar uchun boshlang'ich biriktirish.
-- Sana — tizim kuzatuvi boshlangan payt (SYSTEM_EPOCH, src/domain/assignment.ts).
-- Shunda o'tgan barcha murojaatlar birinchi mas'ul hisobiga to'g'ri tushadi.
INSERT INTO "TaskAssignment" ("taskDefId", "ownerId", "backupId", "from", "until", "reason", "createdAt")
SELECT
  "id",
  "ownerId",
  "backupId",
  '2025-11-01T00:00:00.000Z'::timestamp,
  NULL,
  'Boshlang''ich taqsimot — OTK hujjatidan',
  NOW()
FROM "TaskDef";

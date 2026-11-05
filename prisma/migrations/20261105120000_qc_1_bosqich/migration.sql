-- 1-bosqich: eski Excel-KPI modeli olib tashlanadi, 12 bo'limni tekshirish modeli (Qc*) qo'shiladi.
-- Foydalanuvchilar (User) saqlanadi: CEO/HEAD -> HEAD, SPECIALIST -> INSPECTOR, VIEWER -> VIEWER.

-- 1. Eski jadvallar (bog'liqlik tartibida)
DROP TABLE IF EXISTS "ActivityLog" CASCADE;
DROP TABLE IF EXISTS "AuditAnswer" CASCADE;
DROP TABLE IF EXISTS "Audit" CASCADE;
DROP TABLE IF EXISTS "ChecklistItem" CASCADE;
DROP TABLE IF EXISTS "ChecklistTemplate" CASCADE;
DROP TABLE IF EXISTS "BaselineBreakdown" CASCADE;
DROP TABLE IF EXISTS "BaselineMonthStat" CASCADE;
DROP TABLE IF EXISTS "BaselineMonth" CASCADE;
DROP TABLE IF EXISTS "BaselineAccount" CASCADE;
DROP TABLE IF EXISTS "BaselineImport" CASCADE;
DROP TABLE IF EXISTS "CapacityZone" CASCADE;
DROP TABLE IF EXISTS "CapacityScenario" CASCADE;
DROP TABLE IF EXISTS "Goal" CASCADE;
DROP TABLE IF EXISTS "KpiResult" CASCADE;
DROP TABLE IF EXISTS "KpiFact" CASCADE;
DROP TABLE IF EXISTS "KpiPeriod" CASCADE;
DROP TABLE IF EXISTS "KpiIndicator" CASCADE;
DROP TABLE IF EXISTS "ReviewItem" CASCADE;
DROP TABLE IF EXISTS "RootCauseAction" CASCADE;
DROP TABLE IF EXISTS "Ticket" CASCADE;
DROP TABLE IF EXISTS "TaskAssignment" CASCADE;
DROP TABLE IF EXISTS "TaskDef" CASCADE;
DROP TABLE IF EXISTS "Zone" CASCADE;

DROP TYPE IF EXISTS "ActionStatus";
DROP TYPE IF EXISTS "BreakdownKind";
DROP TYPE IF EXISTS "ChecklistKind";
DROP TYPE IF EXISTS "Direction";
DROP TYPE IF EXISTS "KpiUnit";
DROP TYPE IF EXISTS "MetricSource";
DROP TYPE IF EXISTS "PeriodStatus";
DROP TYPE IF EXISTS "Priority";
DROP TYPE IF EXISTS "ReviewResult";
DROP TYPE IF EXISTS "TaskKind";
DROP TYPE IF EXISTS "TicketSource";
DROP TYPE IF EXISTS "TicketStatus";

-- 2. Rol: yangi qiymatlar
CREATE TYPE "Role_new" AS ENUM ('HEAD', 'INSPECTOR', 'VIEWER');
DROP INDEX IF EXISTS "User_role_active_idx";
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'CEO' THEN 'HEAD'
    WHEN 'HEAD' THEN 'HEAD'
    WHEN 'SPECIALIST' THEN 'INSPECTOR'
    ELSE 'VIEWER'
  END
)::"Role_new";
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

ALTER TABLE "User" DROP COLUMN IF EXISTS "salary";
ALTER TABLE "User" ADD COLUMN "deptId" TEXT;

-- 3. Yangi jadvallar
CREATE TYPE "QcTaskStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "QcDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "norm" INTEGER NOT NULL DEFAULT 90,
    "estimate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QcDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QcCheckpoint" (
    "deptId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "grp" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QcCheckpoint_pkey" PRIMARY KEY ("deptId", "id")
);

CREATE TABLE "QcAudit" (
    "id" TEXT NOT NULL,
    "deptId" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "byId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "notes" JSONB NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QcAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QcTask" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "deptId" TEXT NOT NULL,
    "cpId" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "due" VARCHAR(10) NOT NULL,
    "status" "QcTaskStatus" NOT NULL DEFAULT 'OPEN',
    "checkedById" TEXT,
    "checkedOn" VARCHAR(10),
    "checkNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QcTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QcDepartment_active_position_idx" ON "QcDepartment"("active", "position");
CREATE INDEX "QcAudit_deptId_date_idx" ON "QcAudit"("deptId", "date");
CREATE INDEX "QcAudit_date_idx" ON "QcAudit"("date");
CREATE INDEX "QcTask_deptId_status_due_idx" ON "QcTask"("deptId", "status", "due");
CREATE INDEX "QcTask_auditId_idx" ON "QcTask"("auditId");

ALTER TABLE "User" ADD CONSTRAINT "User_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "QcDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QcCheckpoint" ADD CONSTRAINT "QcCheckpoint_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "QcDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QcAudit" ADD CONSTRAINT "QcAudit_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "QcDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QcAudit" ADD CONSTRAINT "QcAudit_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QcTask" ADD CONSTRAINT "QcTask_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "QcAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QcTask" ADD CONSTRAINT "QcTask_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "QcDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QcTask" ADD CONSTRAINT "QcTask_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

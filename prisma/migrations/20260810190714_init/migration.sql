-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CEO', 'HEAD', 'SPECIALIST', 'VIEWER');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('PROACTIVE', 'REACTIVE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('MANUAL', 'IMPORT', 'TELEGRAM', 'SYSTEM_102', 'API');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "KpiUnit" AS ENUM ('PERCENT', 'HOURS', 'COUNT', 'RATIO');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'TRIAL', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChecklistKind" AS ENUM ('WAREHOUSE', 'BRANCH', 'CALL');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewResult" AS ENUM ('PENDING', 'RESOLVED', 'UNRESOLVED', 'NOT_RELEVANT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "position" TEXT NOT NULL,
    "salary" DECIMAL(14,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TaskDef" (
    "id" SERIAL NOT NULL,
    "no" INTEGER NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "backupId" TEXT,
    "frequency" TEXT NOT NULL,
    "slaHours" INTEGER,
    "priority" "Priority" NOT NULL,
    "kind" "TaskKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TaskDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "channel" TEXT NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "taskDefId" INTEGER,
    "category" TEXT NOT NULL,
    "objectName" TEXT,
    "description" TEXT NOT NULL,
    "externalRef" TEXT,
    "ownerId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "kind" "TaskKind" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "firstResponseAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "spentHours" DECIMAL(7,2),
    "slaHours" INTEGER NOT NULL,
    "slaMet" BOOLEAN,
    "isRepeat" BOOLEAN NOT NULL DEFAULT false,
    "rootCause" TEXT,
    "actionTaken" TEXT,
    "source" "TicketSource" NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiIndicator" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "weight" DECIMAL(5,4) NOT NULL,
    "direction" "Direction" NOT NULL,
    "target" DECIMAL(12,4) NOT NULL,
    "targetText" TEXT NOT NULL,
    "unit" "KpiUnit" NOT NULL,
    "formula" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "metricSource" "MetricSource" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "KpiIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiPeriod" (
    "id" SERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "bonusShare" DECIMAL(4,3) NOT NULL,
    "threshold" DECIMAL(5,2) NOT NULL,
    "cap" DECIMAL(4,3) NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "ceoComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiFact" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "indicatorId" INTEGER NOT NULL,
    "autoValue" DECIMAL(14,4),
    "manualValue" DECIMAL(14,4),
    "usedValue" DECIMAL(14,4),
    "achievement" DECIMAL(8,4),
    "score" DECIMAL(8,4),
    "comment" TEXT,
    "overriddenById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiResult" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "totalScore" DECIMAL(8,4) NOT NULL,
    "grade" TEXT NOT NULL,
    "salary" DECIMAL(14,2),
    "bonus" DECIMAL(14,2) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" SERIAL NOT NULL,
    "kind" "ChecklistKind" NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "no" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "max" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "kind" "ChecklistKind" NOT NULL,
    "objectName" TEXT NOT NULL,
    "objectCode" TEXT,
    "externalRef" TEXT,
    "auditedAt" DATE NOT NULL,
    "auditorId" TEXT NOT NULL,
    "previousPercent" DECIMAL(5,4),
    "totalScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "percent" DECIMAL(5,4) NOT NULL,
    "verdict" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditAnswer" (
    "id" SERIAL NOT NULL,
    "auditId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "AuditAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityScenario" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "monthlyVolume" INTEGER NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "hoursPerDay" DECIMAL(4,2) NOT NULL,
    "specialists" DECIMAL(4,2) NOT NULL,
    "utilisation" DECIMAL(4,3) NOT NULL,
    "proactiveShare" DECIMAL(4,3) NOT NULL,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityZone" (
    "id" SERIAL NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "flowShare" DECIMAL(4,3) NOT NULL,
    "minutesPerCase" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "CapacityZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RootCauseAction" (
    "id" SERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "repeatCount" INTEGER NOT NULL DEFAULT 0,
    "rootCause" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "responsibleDept" TEXT NOT NULL,
    "dueDate" DATE,
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "verifiedAt" TIMESTAMP(3),
    "effect" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RootCauseAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" SERIAL NOT NULL,
    "occurredOn" DATE NOT NULL,
    "track" TEXT,
    "customer" TEXT NOT NULL,
    "originType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hasTrack" BOOLEAN NOT NULL,
    "result" "ReviewResult" NOT NULL DEFAULT 'PENDING',
    "resolvedWhere" TEXT,
    "note" TEXT,
    "assignedToId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineMonth" (
    "period" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cases" INTEGER NOT NULL,
    "noTrace" INTEGER NOT NULL,
    "withTrack" INTEGER NOT NULL,
    "medianFirstResponseMin" DECIMAL(8,2) NOT NULL,
    "system102Cases" INTEGER,

    CONSTRAINT "BaselineMonth_pkey" PRIMARY KEY ("period")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" SERIAL NOT NULL,
    "metric" TEXT NOT NULL,
    "current" TEXT NOT NULL,
    "inThree" TEXT NOT NULL,
    "inSix" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_key_key" ON "User"("key");

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_ownerId_key" ON "Zone"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDef_no_key" ON "TaskDef"("no");

-- CreateIndex
CREATE INDEX "TaskDef_zoneCode_kind_idx" ON "TaskDef"("zoneCode", "kind");

-- CreateIndex
CREATE INDEX "TaskDef_ownerId_idx" ON "TaskDef"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ref_key" ON "Ticket"("ref");

-- CreateIndex
CREATE INDEX "Ticket_date_idx" ON "Ticket"("date");

-- CreateIndex
CREATE INDEX "Ticket_ownerId_date_idx" ON "Ticket"("ownerId", "date");

-- CreateIndex
CREATE INDEX "Ticket_zoneCode_date_idx" ON "Ticket"("zoneCode", "date");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_kind_date_idx" ON "Ticket"("kind", "date");

-- CreateIndex
CREATE INDEX "Ticket_externalRef_idx" ON "Ticket"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "KpiIndicator_code_key" ON "KpiIndicator"("code");

-- CreateIndex
CREATE INDEX "KpiIndicator_ownerId_active_idx" ON "KpiIndicator"("ownerId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "KpiPeriod_period_key" ON "KpiPeriod"("period");

-- CreateIndex
CREATE UNIQUE INDEX "KpiFact_periodId_indicatorId_key" ON "KpiFact"("periodId", "indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiResult_periodId_userId_key" ON "KpiResult"("periodId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_kind_key" ON "ChecklistTemplate"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_templateId_no_key" ON "ChecklistItem"("templateId", "no");

-- CreateIndex
CREATE INDEX "Audit_kind_auditedAt_idx" ON "Audit"("kind", "auditedAt");

-- CreateIndex
CREATE INDEX "Audit_auditorId_auditedAt_idx" ON "Audit"("auditorId", "auditedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditAnswer_auditId_itemId_key" ON "AuditAnswer"("auditId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityScenario_name_period_key" ON "CapacityScenario"("name", "period");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityZone_scenarioId_zoneCode_key" ON "CapacityZone"("scenarioId", "zoneCode");

-- CreateIndex
CREATE INDEX "RootCauseAction_period_status_idx" ON "RootCauseAction"("period", "status");

-- CreateIndex
CREATE INDEX "ReviewItem_result_idx" ON "ReviewItem"("result");

-- CreateIndex
CREATE INDEX "ReviewItem_hasTrack_result_idx" ON "ReviewItem"("hasTrack", "result");

-- CreateIndex
CREATE INDEX "ReviewItem_track_idx" ON "ReviewItem"("track");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_metric_key" ON "Goal"("metric");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entity_entityId_idx" ON "ActivityLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDef" ADD CONSTRAINT "TaskDef_zoneCode_fkey" FOREIGN KEY ("zoneCode") REFERENCES "Zone"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDef" ADD CONSTRAINT "TaskDef_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDef" ADD CONSTRAINT "TaskDef_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_zoneCode_fkey" FOREIGN KEY ("zoneCode") REFERENCES "Zone"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_taskDefId_fkey" FOREIGN KEY ("taskDefId") REFERENCES "TaskDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiIndicator" ADD CONSTRAINT "KpiIndicator_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiPeriod" ADD CONSTRAINT "KpiPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiFact" ADD CONSTRAINT "KpiFact_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "KpiPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiFact" ADD CONSTRAINT "KpiFact_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "KpiIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiFact" ADD CONSTRAINT "KpiFact_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiResult" ADD CONSTRAINT "KpiResult_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "KpiPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiResult" ADD CONSTRAINT "KpiResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAnswer" ADD CONSTRAINT "AuditAnswer_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAnswer" ADD CONSTRAINT "AuditAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityZone" ADD CONSTRAINT "CapacityZone_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "CapacityScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RootCauseAction" ADD CONSTRAINT "RootCauseAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

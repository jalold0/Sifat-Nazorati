-- CreateEnum
CREATE TYPE "BreakdownKind" AS ENUM ('HOUR', 'WEEKDAY', 'TOPIC');

-- DropTable
DROP TABLE "BaselineMonth";

-- CreateTable
CREATE TABLE "BaselineImport" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "sourceFile" TEXT,
    "note" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT,
    "totalCases" INTEGER NOT NULL,
    "withTrack" INTEGER NOT NULL,
    "withoutTrack" INTEGER NOT NULL,
    "uniqueCustomers" INTEGER NOT NULL,
    "sharedCases" INTEGER NOT NULL,
    "accountsSum" INTEGER NOT NULL,
    "excludedCases" INTEGER NOT NULL,
    "answeredCases" INTEGER NOT NULL,
    "lateAnswered" INTEGER NOT NULL,
    "noTraceCases" INTEGER NOT NULL,
    "otherChannel" INTEGER NOT NULL,
    "noReplyNeeded" INTEGER NOT NULL,
    "medianFirstResponseMin" DECIMAL(8,2) NOT NULL,
    "within1hShare" DECIMAL(5,4) NOT NULL,
    "within24hShare" DECIMAL(5,4) NOT NULL,
    "outsideHoursShare" DECIMAL(5,4) NOT NULL,
    "system102Cases" INTEGER NOT NULL,
    "totalMessages" INTEGER NOT NULL,
    "totalSessions" INTEGER NOT NULL,

    CONSTRAINT "BaselineImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineAccount" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "account" TEXT NOT NULL,
    "cases" INTEGER NOT NULL,
    "ownOnly" INTEGER NOT NULL,
    "shared" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL,
    "tracks" INTEGER NOT NULL,
    "customers" INTEGER NOT NULL,
    "unanswered" INTEGER NOT NULL,
    "medianMin" DECIMAL(8,2),
    "within1h" DECIMAL(5,4),

    CONSTRAINT "BaselineAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineMonthStat" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cases" INTEGER NOT NULL,
    "noTrace" INTEGER NOT NULL,
    "withTrack" INTEGER NOT NULL,
    "medianFirstResponseMin" DECIMAL(8,2) NOT NULL,
    "system102Cases" INTEGER,

    CONSTRAINT "BaselineMonthStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineBreakdown" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "kind" "BreakdownKind" NOT NULL,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "BaselineBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baseline102Operator" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "status" INTEGER NOT NULL,
    "archive" INTEGER NOT NULL,
    "approved" INTEGER NOT NULL,

    CONSTRAINT "Baseline102Operator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BaselineImport_isCurrent_idx" ON "BaselineImport"("isCurrent");

-- CreateIndex
CREATE INDEX "BaselineImport_importedAt_idx" ON "BaselineImport"("importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineAccount_importId_account_key" ON "BaselineAccount"("importId", "account");

-- CreateIndex
CREATE INDEX "BaselineMonthStat_period_idx" ON "BaselineMonthStat"("period");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineMonthStat_importId_period_key" ON "BaselineMonthStat"("importId", "period");

-- CreateIndex
CREATE INDEX "BaselineBreakdown_importId_kind_idx" ON "BaselineBreakdown"("importId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineBreakdown_importId_kind_label_key" ON "BaselineBreakdown"("importId", "kind", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Baseline102Operator_importId_login_key" ON "Baseline102Operator"("importId", "login");

-- AddForeignKey
ALTER TABLE "BaselineImport" ADD CONSTRAINT "BaselineImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineAccount" ADD CONSTRAINT "BaselineAccount_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BaselineImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineMonthStat" ADD CONSTRAINT "BaselineMonthStat_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BaselineImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineBreakdown" ADD CONSTRAINT "BaselineBreakdown_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BaselineImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baseline102Operator" ADD CONSTRAINT "Baseline102Operator_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BaselineImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;


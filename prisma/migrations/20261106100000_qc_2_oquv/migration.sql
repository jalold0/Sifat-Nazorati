-- 2-bosqich: o'quv dasturi/test, xodim natijasi, haftalik hisobot izohi. Faqat yangi jadvallar (qo'shimcha).

CREATE TABLE "QcTraining" (
    "deptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL DEFAULT '',
    "passPct" INTEGER NOT NULL DEFAULT 70,
    "days" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QcTraining_pkey" PRIMARY KEY ("deptId")
);

CREATE TABLE "QcTrainingTask" (
    "userId" TEXT NOT NULL,
    "deptId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QcTrainingTask_pkey" PRIMARY KEY ("userId", "deptId", "key")
);

CREATE TABLE "QcTrainingAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deptId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "pct" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    CONSTRAINT "QcTrainingAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QcReport" (
    "week" VARCHAR(10) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "byId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QcReport_pkey" PRIMARY KEY ("week")
);

CREATE INDEX "QcTrainingAttempt_userId_deptId_at_idx" ON "QcTrainingAttempt"("userId", "deptId", "at");
CREATE INDEX "QcTrainingAttempt_at_idx" ON "QcTrainingAttempt"("at");

ALTER TABLE "QcTraining" ADD CONSTRAINT "QcTraining_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "QcDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QcTrainingTask" ADD CONSTRAINT "QcTrainingTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QcTrainingTask" ADD CONSTRAINT "QcTrainingTask_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "QcDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QcTrainingAttempt" ADD CONSTRAINT "QcTrainingAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QcTrainingAttempt" ADD CONSTRAINT "QcTrainingAttempt_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "QcDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QcReport" ADD CONSTRAINT "QcReport_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

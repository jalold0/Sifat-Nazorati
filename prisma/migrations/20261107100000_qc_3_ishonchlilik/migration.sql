-- 3-bosqich (ishonchlilik): o'zgarishlar jurnali, tekshiruvda og'irlik nusxasi, majburiy parol almashtirish.

ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "QcAudit" ADD COLUMN "weights" JSONB;

-- Mavjud tekshiruvlar uchun joriy og'irliklar nusxalanadi: shu paytdan boshlab ular qotadi.
UPDATE "QcAudit" a
SET "weights" = COALESCE(
  (SELECT jsonb_object_agg(c."id", c."weight") FROM "QcCheckpoint" c WHERE c."deptId" = a."deptId"),
  '{}'::jsonb
);

CREATE TABLE "QcLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    CONSTRAINT "QcLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QcLog_at_idx" ON "QcLog"("at");
CREATE INDEX "QcLog_entity_entityId_idx" ON "QcLog"("entity", "entityId");

ALTER TABLE "QcLog" ADD CONSTRAINT "QcLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

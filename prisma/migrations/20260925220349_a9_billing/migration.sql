-- AlterEnum
ALTER TYPE "PlanId" ADD VALUE 'FREE';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "nextPlan" "PlanId",
ADD COLUMN     "nextPlanFrom" TIMESTAMP(3),
ADD COLUMN     "reminderSentFor" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TrialGrant" (
    "mobile" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialGrant_pkey" PRIMARY KEY ("mobile")
);

-- ---------------------------------------------------------------------------
-- Backfill (A9): every existing seller's mobile has had its trial, so a store
-- deleted later can't start a second one. Their subscriptions are unchanged.
-- ---------------------------------------------------------------------------
INSERT INTO "TrialGrant" ("mobile", "grantedAt")
SELECT s."mobile", s."createdAt"
FROM "Seller" s
ON CONFLICT ("mobile") DO NOTHING;

-- CreateEnum
CREATE TYPE "PaymentFailureReason" AS ENUM ('CANCELED_BY_USER', 'AMOUNT_MISMATCH', 'GATEWAY_ERROR', 'EXPIRED');

-- AlterEnum
ALTER TYPE "SmsStatus" ADD VALUE 'PENDING';

-- DropIndex
DROP INDEX "PaymentAttempt_authority_key";

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "failureDetail" TEXT,
ADD COLUMN     "failureReason" "PaymentFailureReason";

-- AlterTable
ALTER TABLE "SmsMessage" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_authority_key" ON "PaymentAttempt"("provider", "authority");

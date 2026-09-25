-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "PlanId" AS ENUM ('TRIAL', 'BASIC', 'GROWTH', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('ZARINPAL', 'IDPAY');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SmsKind" AS ENUM ('LOGIN_OTP', 'ORDER_PLACED', 'ORDER_PAID', 'ORDER_SHIPPED', 'PAYMENT_REMINDER', 'MEMBER_INVITE', 'SUBSCRIPTION_REMINDER');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('SENT', 'FAILED', 'DEV');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ONLINE';

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "cardHolder" TEXT,
ADD COLUMN     "cardNumberEncrypted" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "shebaEncrypted" TEXT,
ADD COLUMN     "smsOnOrderPlaced" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsOnPaid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsOnShipped" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "telegram" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "plan" "PlanId" NOT NULL DEFAULT 'TRIAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "plan" "PlanId" NOT NULL,
    "amount" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerGateway" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "credentialsEncrypted" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "provider" "GatewayProvider" NOT NULL,
    "amount" INTEGER NOT NULL,
    "authority" TEXT,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "refId" TEXT,
    "cardPanMasked" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT,
    "to" TEXT NOT NULL,
    "kind" "SmsKind" NOT NULL,
    "orderId" TEXT,
    "status" "SmsStatus" NOT NULL,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkDailyView" (
    "purchaseLinkId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LinkDailyView_pkey" PRIMARY KEY ("purchaseLinkId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE INDEX "Membership_sellerId_idx" ON "Membership"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_sellerId_key" ON "Membership"("userId", "sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_sellerId_key" ON "Subscription"("sellerId");

-- CreateIndex
CREATE INDEX "Invoice_sellerId_createdAt_idx" ON "Invoice"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerGateway_sellerId_key" ON "SellerGateway"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_authority_key" ON "PaymentAttempt"("authority");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_idx" ON "PaymentAttempt"("orderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_invoiceId_idx" ON "PaymentAttempt"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_sellerId_createdAt_idx" ON "PaymentAttempt"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsMessage_sellerId_createdAt_idx" ON "SmsMessage"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsMessage_orderId_kind_key" ON "SmsMessage"("orderId", "kind");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerGateway" ADD CONSTRAINT "SellerGateway_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkDailyView" ADD CONSTRAINT "LinkDailyView_purchaseLinkId_fkey" FOREIGN KEY ("purchaseLinkId") REFERENCES "PurchaseLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill (Phase 2 Step 0): every existing seller becomes an account.
-- Timestamps are written in UTC explicitly: columns are timestamp without time
-- zone holding UTC, and now() alone would follow the server's time zone.
-- ---------------------------------------------------------------------------

-- A User for each seller's login mobile.
INSERT INTO "User" ("id", "mobile", "createdAt")
SELECT 'usr_' || s."id", s."mobile", s."createdAt"
FROM "Seller" s
ON CONFLICT ("mobile") DO NOTHING;

-- That user owns the store.
INSERT INTO "Membership" ("id", "userId", "sellerId", "role", "createdAt")
SELECT 'mem_' || s."id", u."id", s."id", 'OWNER', (now() AT TIME ZONE 'UTC')
FROM "Seller" s
JOIN "User" u ON u."mobile" = s."mobile"
ON CONFLICT ("userId", "sellerId") DO NOTHING;

-- Every existing seller starts a 30-day trial.
INSERT INTO "Subscription" ("id", "sellerId", "plan", "status", "currentPeriodEnd", "createdAt", "updatedAt")
SELECT 'sub_' || s."id", s."id", 'TRIAL', 'TRIALING',
       (now() AT TIME ZONE 'UTC') + interval '30 days',
       (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC')
FROM "Seller" s
ON CONFLICT ("sellerId") DO NOTHING;
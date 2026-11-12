-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ORDER_NEW', 'RECEIPT_UPLOADED', 'ORDER_PAID_ONLINE', 'SUBSCRIPTION_ENDING');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "orderId" TEXT,
    "text" TEXT NOT NULL,
    "ownerOnly" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_sellerId_readAt_idx" ON "Notification"("sellerId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_sellerId_createdAt_idx" ON "Notification"("sellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

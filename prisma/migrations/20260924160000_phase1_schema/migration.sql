-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('MANUAL_ADJUSTMENT', 'ORDER_PLACED', 'ORDER_CANCELED', 'ORDER_RETURNED', 'INITIAL');

-- CreateEnum
CREATE TYPE "CustomerTag" AS ENUM ('NEW', 'LOYAL', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MANUAL', 'PURCHASE_LINK');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD_TO_CARD', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "ShippingStatus" AS ENUM ('NOT_SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'FAILED');

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropIndex
DROP INDEX "Seller_email_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "tag" "CustomerTag" NOT NULL DEFAULT 'NEW',
ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "purchaseLinkId" TEXT,
ADD COLUMN     "receiptImageUrl" TEXT,
ADD COLUMN     "shippingStatus" "ShippingStatus" NOT NULL DEFAULT 'NOT_SHIPPED',
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "totalPrice" SET DATA TYPE INTEGER,
ALTER COLUMN "shippingCost" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "unitPrice" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 3,
ALTER COLUMN "price" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Seller" DROP COLUMN "email",
ADD COLUMN     "mobile" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLink" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductToPurchaseLink" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductToPurchaseLink_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "OtpCode_mobile_createdAt_idx" ON "OtpCode"("mobile", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLink_token_key" ON "PurchaseLink"("token");

-- CreateIndex
CREATE INDEX "PurchaseLink_sellerId_idx" ON "PurchaseLink"("sellerId");

-- CreateIndex
CREATE INDEX "_ProductToPurchaseLink_B_index" ON "_ProductToPurchaseLink"("B");

-- CreateIndex
CREATE INDEX "Customer_sellerId_idx" ON "Customer"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");

-- CreateIndex
CREATE INDEX "Order_sellerId_status_idx" ON "Order"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Order_sellerId_createdAt_idx" ON "Order"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_mobile_key" ON "Seller"("mobile");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_purchaseLinkId_fkey" FOREIGN KEY ("purchaseLinkId") REFERENCES "PurchaseLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLink" ADD CONSTRAINT "PurchaseLink_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToPurchaseLink" ADD CONSTRAINT "_ProductToPurchaseLink_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToPurchaseLink" ADD CONSTRAINT "_ProductToPurchaseLink_B_fkey" FOREIGN KEY ("B") REFERENCES "PurchaseLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

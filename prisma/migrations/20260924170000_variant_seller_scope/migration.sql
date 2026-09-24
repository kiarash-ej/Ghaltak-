-- SKU uniqueness must be per seller, not global (multi-tenant).
-- Add sellerId to ProductVariant, backfill it from the product, then enforce.

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "sellerId" TEXT;

UPDATE "ProductVariant" v
SET "sellerId" = p."sellerId"
FROM "Product" p
WHERE p."id" = v."productId";

ALTER TABLE "ProductVariant" ALTER COLUMN "sellerId" SET NOT NULL;

-- DropIndex
DROP INDEX "ProductVariant_sku_key";

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sellerId_sku_key" ON "ProductVariant"("sellerId", "sku");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

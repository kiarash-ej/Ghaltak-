-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "smsOnPaymentReminder" BOOLEAN NOT NULL DEFAULT true;

-- The reminder used to follow the «ثبت سفارش» switch: keep each store's choice.
UPDATE "Seller" SET "smsOnPaymentReminder" = "smsOnOrderPlaced";

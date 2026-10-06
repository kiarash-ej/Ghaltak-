-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('ADS', 'PACKAGING', 'SHIPPING', 'RENT', 'SALARY', 'SERVICES', 'OTHER');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "unitCost" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPrice" INTEGER;

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "spentOn" DATE NOT NULL,
    "note" TEXT,
    "recurringExpenseId" TEXT,
    "monthKey" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "dayOfMonth" INTEGER NOT NULL,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_sellerId_spentOn_idx" ON "Expense"("sellerId", "spentOn");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_recurringExpenseId_monthKey_key" ON "Expense"("recurringExpenseId", "monthKey");

-- CreateIndex
CREATE INDEX "RecurringExpense_sellerId_idx" ON "RecurringExpense"("sellerId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

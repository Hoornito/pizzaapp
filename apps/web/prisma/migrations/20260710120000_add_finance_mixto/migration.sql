-- AlterEnum
ALTER TYPE "FinancePaymentMethod" ADD VALUE 'MIXTO';

-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN "cashAmount" DECIMAL(10,2);

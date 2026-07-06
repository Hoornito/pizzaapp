-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'MIXTO';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cashAmount" DECIMAL(10,2),
ADD COLUMN     "transferAmount" DECIMAL(10,2);

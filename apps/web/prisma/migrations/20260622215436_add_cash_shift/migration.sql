-- CreateEnum
CREATE TYPE "CashShift" AS ENUM ('MANANA', 'NOCHE');

-- AlterTable
ALTER TABLE "CashRegister" ADD COLUMN     "shift" "CashShift";

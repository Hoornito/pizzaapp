-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('COCINERO', 'REPARTIDOR', 'OTRO');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "role" "EmployeeRole" NOT NULL DEFAULT 'OTRO';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryEmployeeId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priceLarge" DECIMAL(10,2),
ADD COLUMN     "priceMedium" DECIMAL(10,2),
ADD COLUMN     "priceSmall" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Employee_role_idx" ON "Employee"("role");

-- CreateIndex
CREATE INDEX "Order_deliveryEmployeeId_idx" ON "Order"("deliveryEmployeeId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryEmployeeId_fkey" FOREIGN KEY ("deliveryEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

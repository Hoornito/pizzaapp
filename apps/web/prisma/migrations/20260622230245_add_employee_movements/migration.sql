-- CreateEnum
CREATE TYPE "EmployeeMovementKind" AS ENUM ('ADELANTO', 'ADELANTO_DESCUENTO', 'ACUMULADO_APORTE', 'ACUMULADO_RETIRO');

-- CreateTable
CREATE TABLE "EmployeeMovement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "EmployeeMovementKind" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "financeTransactionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMovement_financeTransactionId_key" ON "EmployeeMovement"("financeTransactionId");

-- CreateIndex
CREATE INDEX "EmployeeMovement_employeeId_idx" ON "EmployeeMovement"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeMovement_kind_idx" ON "EmployeeMovement"("kind");

-- CreateIndex
CREATE INDEX "EmployeeMovement_createdAt_idx" ON "EmployeeMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "EmployeeMovement" ADD CONSTRAINT "EmployeeMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

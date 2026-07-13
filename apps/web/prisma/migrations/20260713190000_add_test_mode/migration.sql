-- Caja de simulación (entrenamiento) y sus datos descartables.
ALTER TABLE "CashRegister" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EmployeeMovement" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

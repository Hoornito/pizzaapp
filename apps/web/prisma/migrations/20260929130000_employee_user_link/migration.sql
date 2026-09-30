-- Cuenta de usuario vinculada al empleado (para que vea su legajo).
-- Aditiva: columna nullable, no rompe el codigo anterior.
ALTER TABLE "Employee" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

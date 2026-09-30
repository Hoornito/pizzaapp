-- Años de antigüedad pre-cobrados por empleado (historial de cobros).
-- Aditiva: tabla nueva, no toca las existentes.
CREATE TABLE "EmployeeSeniorityPayout" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "years" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSeniorityPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeSeniorityPayout_employeeId_idx" ON "EmployeeSeniorityPayout"("employeeId");

ALTER TABLE "EmployeeSeniorityPayout" ADD CONSTRAINT "EmployeeSeniorityPayout_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

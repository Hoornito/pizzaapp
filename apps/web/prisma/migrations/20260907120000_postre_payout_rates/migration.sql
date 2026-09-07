-- Tarifa de pago a la persona de postres, con historia.
--
-- Append-only: cambiar el pago crea una fila nueva con effectiveFrom = ahora, y
-- las ventas anteriores se siguen pagando con la tarifa que regia ese dia.
--
-- No se siembra ninguna fila a proposito: mientras la tabla este vacia, TODO el
-- historico se paga con los valores por defecto del codigo (grande $5.000 /
-- chico $2.500), que es lo que se venia pagando. La primera fila aparece recien
-- cuando el local guarda un valor distinto desde el panel.
CREATE TABLE "PostrePayoutRate" (
    "id" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostrePayoutRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostrePayoutRate_size_effectiveFrom_idx" ON "PostrePayoutRate"("size", "effectiveFrom");

-- Descuento general de la app (una sola fila, id fijo). Solo afecta a los
-- pedidos hechos por clientes desde la web; los que carga el local no.
CREATE TABLE "AppDiscount" (
    "id" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppDiscount_pkey" PRIMARY KEY ("id")
);

-- Barrios/countries con la franja en la que no se reparte ahí (al mediodía no
-- se llega a los barrios privados). No reemplaza a ShipmentZone: aquella es por
-- radio y no se usa en el pedido del cliente.
CREATE TABLE "DeliveryArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blockedFrom" TEXT,
    "blockedTo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryArea_pkey" PRIMARY KEY ("id")
);

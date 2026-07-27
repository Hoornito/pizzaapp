-- Propina para el repartidor (delivery), la deja el cliente y se suma al total.
ALTER TABLE "Order" ADD COLUMN "tip" DECIMAL(10,2) NOT NULL DEFAULT 0;

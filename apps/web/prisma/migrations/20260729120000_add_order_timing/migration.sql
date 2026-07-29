-- Marcas de tiempo de inicio/fin del pedido (para medir demoras reales).
-- ADD COLUMN nullable: operacion instantanea de metadata, no bloquea la tabla.
ALTER TABLE "Order" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "finishedAt" TIMESTAMP(3);

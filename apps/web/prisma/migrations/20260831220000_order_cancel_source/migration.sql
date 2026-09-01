-- Origen de la cancelación de un pedido: quién la hizo y cuándo.
-- Los pedidos ya cancelados antes de esta migración quedan con cancelSource
-- NULL a propósito: no hay forma de reconstruir el dato y la UI los muestra
-- como "origen no registrado" en vez de atribuirlos a alguien por defecto.
CREATE TYPE "CancelSource" AS ENUM ('CLIENTE', 'LOCAL', 'SISTEMA');

ALTER TABLE "Order" ADD COLUMN "cancelSource"  "CancelSource";
ALTER TABLE "Order" ADD COLUMN "cancelledAt"   TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "cancelledById" TEXT;

CREATE INDEX "Order_cancelledById_idx" ON "Order"("cancelledById");

ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

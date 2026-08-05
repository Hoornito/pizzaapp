-- Pedidos programados: horario elegido por el cliente en el checkout.
-- Null = "lo antes posible" (el local carga el tiempo estimado a mano).
ALTER TABLE "Order" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- Para listar/ordenar los programados en el panel.
CREATE INDEX "Order_scheduledFor_idx" ON "Order"("scheduledFor");

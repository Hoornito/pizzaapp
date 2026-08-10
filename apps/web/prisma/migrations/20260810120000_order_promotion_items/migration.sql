-- Composición real de cada promoción vendida (qué productos llevó puestos).
-- Antes una promo se guardaba como un solo ítem y los gustos elegidos quedaban
-- como texto en las notas, así que no había forma de saber cuántas empanadas de
-- cada gusto salieron de verdad.
--
-- Solo agrega una tabla: no toca pedidos, precios ni totales.

CREATE TABLE "OrderPromotionItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "chosen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPromotionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderPromotionItem_orderId_idx" ON "OrderPromotionItem"("orderId");
CREATE INDEX "OrderPromotionItem_productId_idx" ON "OrderPromotionItem"("productId");
CREATE INDEX "OrderPromotionItem_promotionId_idx" ON "OrderPromotionItem"("promotionId");

ALTER TABLE "OrderPromotionItem" ADD CONSTRAINT "OrderPromotionItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderPromotionItem" ADD CONSTRAINT "OrderPromotionItem_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderPromotionItem" ADD CONSTRAINT "OrderPromotionItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

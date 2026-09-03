-- Origen del pedido. Nullable a proposito: los pedidos ya cargados quedan en
-- NULL y para ellos sigue valiendo la heuristica vieja (rol del usuario +
-- whatsappToken), asi no hay que backfillear nada.
CREATE TYPE "OrderSource" AS ENUM ('WEB', 'MOSTRADOR', 'WHATSAPP');

ALTER TABLE "Order" ADD COLUMN "source" "OrderSource";

-- Pedidos Ya como canal propio: el pedido lo cobra la plataforma y lo retira su
-- repartidor, así que no es ni "delivery" nuestro ni un retiro del cliente.
--
-- Es aditiva: los pedidos existentes no cambian. Postgres 12+ acepta ALTER TYPE
-- ADD VALUE dentro de la transacción de la migración mientras el valor nuevo no
-- se use en esa misma transacción (acá solo se declara).

ALTER TYPE "DeliveryType" ADD VALUE 'PEDIDOS_YA';
ALTER TYPE "PaymentMethod" ADD VALUE 'PEDIDOS_YA';

-- Repartidor de la plataforma que pasa a buscar el pedido (lo dicta el que
-- atiende). A futuro lo va a completar la API de Pedidos Ya.
ALTER TABLE "Order" ADD COLUMN "courierName" TEXT;

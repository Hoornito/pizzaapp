-- Efectivo con el que paga el cliente ("paga con"), para calcular el vuelto.
ALTER TABLE "Order" ADD COLUMN "cashReceived" DECIMAL(10,2);

-- Plus de Pedidos Ya cargado a mano en el mostrador. Va sumado en subtotal/total
-- y se imprime como una línea más del detalle en la comanda del cliente.
ALTER TABLE "Order" ADD COLUMN "pedidosYaExtra" DECIMAL(10,2);

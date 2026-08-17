-- Direcciones que el cliente eligió guardar para reusar. Las demás siguen
-- existiendo (el pedido y su ticket las necesitan) pero no se le vuelven a
-- ofrecer. Aditiva: las que ya estaban quedan como no guardadas.
ALTER TABLE "Address" ADD COLUMN "saved" BOOLEAN NOT NULL DEFAULT false;

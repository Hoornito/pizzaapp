-- Foto de las tarjetas del menú que no son un producto ni una promo (mitad y
-- mitad, empanadas sueltas): no tenían dónde guardar la imagen.
CREATE TABLE "MenuCardImage" (
    "key" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MenuCardImage_pkey" PRIMARY KEY ("key")
);

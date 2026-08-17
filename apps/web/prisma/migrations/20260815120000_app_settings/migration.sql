-- Ajustes sueltos del negocio, clave→valor. Primer uso: deshabilitar la pizza
-- al molde cuando se quedan sin masa (no se maneja por stock en unidades).
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

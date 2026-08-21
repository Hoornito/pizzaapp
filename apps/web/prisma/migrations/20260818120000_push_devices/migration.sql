-- Dispositivos suscriptos a notificaciones push del cambio de estado del pedido.
-- WEB guarda la suscripción del navegador (endpoint + claves VAPID); ANDROID/IOS
-- guardan el token de FCM que devuelve el plugin de Capacitor.
CREATE TYPE "PushPlatform" AS ENUM ('WEB', 'ANDROID', 'IOS');

CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "platform" "PushPlatform" NOT NULL,
    "token" TEXT,
    "endpoint" TEXT,
    "p256dh" TEXT,
    "auth" TEXT,
    "userAgent" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");
CREATE UNIQUE INDEX "PushDevice_endpoint_key" ON "PushDevice"("endpoint");
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");
CREATE INDEX "PushDevice_active_idx" ON "PushDevice"("active");

ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

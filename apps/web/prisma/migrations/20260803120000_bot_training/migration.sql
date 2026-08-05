-- Entrenamiento del bot de WhatsApp: instrucciones versionadas en la DB
-- (antes solo en wa-bot-instructions.md, que se pierde en cada build) +
-- correcciones del operador desde el simulador.

CREATE TABLE "BotInstruction" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotInstruction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BotInstruction_version_key" ON "BotInstruction"("version");
CREATE INDEX "BotInstruction_createdAt_idx" ON "BotInstruction"("createdAt");

CREATE TABLE "WABotCorrection" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "context" JSONB NOT NULL,
    "badReply" TEXT NOT NULL,
    "goodReply" TEXT NOT NULL,
    "note" TEXT,
    "appliedAt" TIMESTAMP(3),
    "appliedVersion" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WABotCorrection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WABotCorrection_appliedAt_createdAt_idx" ON "WABotCorrection"("appliedAt", "createdAt");

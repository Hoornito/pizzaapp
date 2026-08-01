-- Inbox de WhatsApp: hilo de mensajes + campos de conversación (todo aditivo).
ALTER TABLE "WhatsAppConversation" ADD COLUMN "contactName" TEXT;
ALTER TABLE "WhatsAppConversation" ADD COLUMN "botPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WhatsAppConversation" ADD COLUMN "lastMessageAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppConversation" ADD COLUMN "unread" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT,
    "mediaUrl" TEXT,
    "mediaMime" TEXT,
    "waMessageId" TEXT,
    "status" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");
CREATE INDEX "WhatsAppMessage_waMessageId_idx" ON "WhatsAppMessage"("waMessageId");
CREATE INDEX "WhatsAppConversation_lastMessageAt_idx" ON "WhatsAppConversation"("lastMessageAt");

ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

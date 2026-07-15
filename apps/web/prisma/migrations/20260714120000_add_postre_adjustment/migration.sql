-- Ajustes manuales al "dinero a favor" de postres (firmado).
CREATE TABLE "PostreAdjustment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostreAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PostreAdjustment_createdAt_idx" ON "PostreAdjustment"("createdAt");

-- Saldo a favor de postres traído de otro sistema (unificación). Una sola vez.
INSERT INTO "PostreAdjustment" ("id", "amount", "reason", "createdAt")
VALUES ('postre_adj_carryover_148700', 148700, 'Saldo a favor traído de otro sistema', CURRENT_TIMESTAMP);

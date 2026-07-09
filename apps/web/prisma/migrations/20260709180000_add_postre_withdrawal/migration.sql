-- CreateTable
CREATE TABLE "PostreWithdrawal" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostreWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostreWithdrawal_createdAt_idx" ON "PostreWithdrawal"("createdAt");

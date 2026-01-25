-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastRetryAt" TIMESTAMP(3),
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryStatus" TEXT,
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3;

-- CreateIndex
CREATE INDEX "payments_stripeStatus_nextRetryAt_idx" ON "payments"("stripeStatus", "nextRetryAt");


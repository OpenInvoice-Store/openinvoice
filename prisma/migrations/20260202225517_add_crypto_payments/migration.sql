-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "addressReuseCooldownHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "btcAddressGenerationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "btcXpub" TEXT,
ADD COLUMN     "cryptoMinConfirmations" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "cryptoPaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cryptoWallets" TEXT,
ADD COLUMN     "ethAddressGenerationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stopReusingAddresses" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "crypto_payments" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cryptocurrencyCode" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "transactionHash" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "minConfirmations" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "exchangeRate" DOUBLE PRECISION,
    "fiatAmount" DOUBLE PRECISION NOT NULL,
    "fiatCurrency" TEXT NOT NULL,
    "walletId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crypto_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_address_usage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cryptocurrency" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crypto_address_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crypto_payments_paymentId_key" ON "crypto_payments"("paymentId");

-- CreateIndex
CREATE INDEX "crypto_payments_status_createdAt_idx" ON "crypto_payments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "crypto_payments_address_idx" ON "crypto_payments"("address");

-- CreateIndex
CREATE INDEX "crypto_payments_transactionHash_idx" ON "crypto_payments"("transactionHash");

-- CreateIndex
CREATE INDEX "crypto_payments_organizationId_status_idx" ON "crypto_payments"("organizationId", "status");

-- CreateIndex
CREATE INDEX "crypto_payments_expiresAt_idx" ON "crypto_payments"("expiresAt");

-- CreateIndex
CREATE INDEX "crypto_address_usage_organizationId_cryptocurrency_lastUsed_idx" ON "crypto_address_usage"("organizationId", "cryptocurrency", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_address_usage_organizationId_cryptocurrency_address_key" ON "crypto_address_usage"("organizationId", "cryptocurrency", "address");

-- AddForeignKey
ALTER TABLE "crypto_payments" ADD CONSTRAINT "crypto_payments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_payments" ADD CONSTRAINT "crypto_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_payments" ADD CONSTRAINT "crypto_payments_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "crypto_address_usage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_address_usage" ADD CONSTRAINT "crypto_address_usage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

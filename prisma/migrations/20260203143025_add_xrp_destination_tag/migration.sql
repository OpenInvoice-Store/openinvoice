-- AlterTable
ALTER TABLE "crypto_payments" ADD COLUMN "destinationTag" INTEGER;

-- CreateIndex
CREATE INDEX "crypto_payments_address_destinationTag_idx" ON "crypto_payments"("address", "destinationTag");


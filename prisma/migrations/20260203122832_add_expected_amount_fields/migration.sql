-- AlterTable
ALTER TABLE "payments" ADD COLUMN "expectedAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "crypto_payments" ADD COLUMN "expectedFiatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Update existing records: set expectedAmount = amount for existing payments
UPDATE "payments" SET "expectedAmount" = "amount" WHERE "expectedAmount" IS NULL;

-- Update existing crypto_payments: set expectedFiatAmount = fiatAmount
UPDATE "crypto_payments" SET "expectedFiatAmount" = "fiatAmount" WHERE "expectedFiatAmount" = 0;


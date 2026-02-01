-- DropIndex
DROP INDEX "invoices_taxProfileId_idx";

-- DropIndex
DROP INDEX "invoices_templateId_idx";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "resendApiKey" TEXT,
ADD COLUMN     "resendFromEmail" TEXT,
ADD COLUMN     "resendFromName" TEXT,
ADD COLUMN     "twilioAccountSid" TEXT,
ADD COLUMN     "twilioAuthToken" TEXT,
ADD COLUMN     "twilioFromNumber" TEXT;

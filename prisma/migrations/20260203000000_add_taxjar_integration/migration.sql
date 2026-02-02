-- Migration: Add TaxJar integration
-- Purpose: Enable automatic tax calculation via TaxJar API
-- Date: 2026-02-03

-- AlterTable: Add TaxJar settings to organizations
ALTER TABLE "organizations" ADD COLUMN "taxJarEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "taxJarApiKey" TEXT;
ALTER TABLE "organizations" ADD COLUMN "taxJarNexusRegions" TEXT;

-- AlterTable: Add TaxJar fields to invoices
ALTER TABLE "invoices" ADD COLUMN "taxJarTransactionId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "taxJarTransactionReference" TEXT;

-- AlterTable: Update taxCalculationMethod to support 'taxjar' value
-- Note: This is a comment - the enum constraint will be handled by Prisma if using enum type
-- If using String type, no migration needed for this change

-- AlterTable: Add structured address fields to customers for better tax calculation
ALTER TABLE "customers" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "customers" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "customers" ADD COLUMN "city" TEXT;
ALTER TABLE "customers" ADD COLUMN "state" TEXT;
ALTER TABLE "customers" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "customers" ADD COLUMN "country" TEXT;


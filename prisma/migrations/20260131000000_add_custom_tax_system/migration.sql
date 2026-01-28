-- Migration: Add Custom Tax System
-- Purpose: Add TaxProfile, TaxRule, and InvoiceTax models for custom tax calculation
-- Date: 2026-01-31

-- Create tax_profiles table
CREATE TABLE IF NOT EXISTS "tax_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "regionCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_profiles_pkey" PRIMARY KEY ("id")
);

-- Create tax_rules table
CREATE TABLE IF NOT EXISTS "tax_rules" (
    "id" TEXT NOT NULL,
    "taxProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "authority" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- Create invoice_taxes table
CREATE TABLE IF NOT EXISTS "invoice_taxes" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "authority" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_taxes_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "tax_profiles" ADD CONSTRAINT "tax_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_taxProfileId_fkey" FOREIGN KEY ("taxProfileId") REFERENCES "tax_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_taxes" ADD CONSTRAINT "invoice_taxes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "tax_profiles_organizationId_idx" ON "tax_profiles"("organizationId");
CREATE INDEX IF NOT EXISTS "tax_profiles_organizationId_isDefault_idx" ON "tax_profiles"("organizationId", "isDefault");
CREATE INDEX IF NOT EXISTS "tax_rules_taxProfileId_idx" ON "tax_rules"("taxProfileId");
CREATE INDEX IF NOT EXISTS "invoice_taxes_invoiceId_idx" ON "invoice_taxes"("invoiceId");

-- Add tax system fields to organizations table
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "defaultTaxProfileId" TEXT;

-- Add foreign key for default tax profile
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_defaultTaxProfileId_fkey" FOREIGN KEY ("defaultTaxProfileId") REFERENCES "tax_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add tax system fields to invoices table
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "taxCalculationMethod" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "taxProfileId" TEXT;

-- Add foreign keys for invoice tax profile
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_taxProfileId_fkey" FOREIGN KEY ("taxProfileId") REFERENCES "tax_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for invoice tax fields
CREATE INDEX IF NOT EXISTS "invoices_taxProfileId_idx" ON "invoices"("taxProfileId");


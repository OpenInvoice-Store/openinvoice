-- Migration: Add Stripe Tax support
-- Purpose: Enable automatic tax calculation via Stripe Tax
-- Date: 2026-01-26

-- AlterTable: Add Stripe Tax settings to organizations
ALTER TABLE "organizations" ADD COLUMN "stripeTaxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "taxRegistrationNumber" TEXT;

-- AlterTable: Add Stripe Tax fields to invoices
ALTER TABLE "invoices" ADD COLUMN "stripeTaxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN "stripeTaxCalculationId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "totalTaxAmount" DOUBLE PRECISION;
ALTER TABLE "invoices" ADD COLUMN "taxBreakdown" TEXT;

-- AlterTable: Add Stripe Tax fields to invoice items
ALTER TABLE "invoice_items" ADD COLUMN "stripeTaxAmount" DOUBLE PRECISION;
ALTER TABLE "invoice_items" ADD COLUMN "stripeTaxRate" DOUBLE PRECISION;

-- AlterTable: Add tax exemption fields to customers
ALTER TABLE "customers" ADD COLUMN "taxExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "taxExemptionReason" TEXT;
ALTER TABLE "customers" ADD COLUMN "taxId" TEXT;


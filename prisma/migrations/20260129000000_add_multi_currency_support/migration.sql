-- Migration: Add multi-currency support
-- Purpose: Enable multi-currency support for organizations and invoices
-- Date: 2026-01-29

-- AlterTable: Add defaultCurrency to organizations
ALTER TABLE "organizations" ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable: Add currency to invoices
ALTER TABLE "invoices" ADD COLUMN "currency" TEXT;


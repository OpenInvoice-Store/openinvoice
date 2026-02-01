-- Migration: Add currency to recurring invoice templates
-- Purpose: Enable currency support for recurring invoices and subscriptions
-- Date: 2026-01-30

-- AlterTable: Add currency to recurring_invoice_templates
ALTER TABLE "recurring_invoice_templates" ADD COLUMN "currency" TEXT;
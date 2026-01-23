-- Migration: Add invoice counter table for atomic invoice number generation
-- Purpose: Prevent race conditions when generating sequential invoice numbers
-- Date: 2026-01-22
-- Impact: Adds invoice_counters table to track last invoice number per organization

-- CreateTable
CREATE TABLE "invoice_counters" (
    "organizationId" TEXT NOT NULL,
    "lastInvoiceNo" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("organizationId")
);

-- AddForeignKey
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Initialize counters for existing organizations based on their current highest invoice number
-- This ensures existing organizations start from the correct number
-- Only runs if invoices table exists and has data
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        INSERT INTO "invoice_counters" ("organizationId", "lastInvoiceNo", "updatedAt")
        SELECT 
            "organizationId",
            COALESCE(MAX("invoiceNo"), 0) as "lastInvoiceNo",
            NOW() as "updatedAt"
        FROM "invoices"
        GROUP BY "organizationId"
        ON CONFLICT ("organizationId") DO NOTHING;
    END IF;
END $$;

-- For organizations that don't have any invoices yet, we'll create counters on-demand
-- This is handled by the application code using upsert


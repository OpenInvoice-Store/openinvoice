-- Migration: Add invoice counter table for atomic invoice number generation
-- Purpose: Replace SELECT FOR UPDATE with counter table for better performance
-- Date: 2026-01-22
-- Impact: Adds invoice_counters table, updates Invoice unique constraints

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoice_counters" (
    "organizationId" TEXT NOT NULL,
    "lastInvoiceNo" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("organizationId")
);

-- AddForeignKey
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the old unique constraint on invoiceNo (if it exists)
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoiceNo_key";

-- Add composite unique constraint on [organizationId, invoiceNo]
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_invoiceNo_key" 
    UNIQUE ("organizationId", "invoiceNo");

-- Add index for performance
CREATE INDEX IF NOT EXISTS "invoices_organizationId_createdAt_idx" 
    ON "invoices"("organizationId", "createdAt");

-- Initialize counters for existing organizations based on their current highest invoice number
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


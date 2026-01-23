-- Migration: Enforce required organizationId for data isolation
-- Purpose: Make organizationId non-nullable to prevent data leakage
-- Date: 2026-01-22
-- Impact: All invoices, customers, and products must belong to an organization
-- WARNING: This clears all existing data without organizationId
--          Only run this if you don't need to preserve existing data

-- Clear old data (since old data is not needed)
-- This ensures no records exist without organizationId
-- Note: Only delete if tables exist (for migration safety)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments') THEN
        DELETE FROM "payments";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
        DELETE FROM "invoice_items";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        DELETE FROM "invoices";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers') THEN
        DELETE FROM "customers";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products') THEN
        DELETE FROM "products";
    END IF;
END $$;

-- Make organizationId columns NOT NULL
-- This enforces data isolation at the database level
ALTER TABLE "customers" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "organizationId" SET NOT NULL;


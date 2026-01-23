-- Migration: Remove invoice counter table (no longer needed)
-- Purpose: Clean up unused counter table after switching to SELECT FOR UPDATE approach
-- Date: 2026-01-22
-- Impact: Drops invoice_counters table

-- Drop the invoice_counters table if it exists
DROP TABLE IF EXISTS "invoice_counters";


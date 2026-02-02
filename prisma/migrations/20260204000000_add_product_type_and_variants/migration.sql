-- Migration: Add product type and variants support
-- Purpose: Allow products to have types (shoe, tshirt, etc.) and variant attributes (size, color, etc.)
-- Date: 2026-02-04

-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "productType" TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variants" TEXT;


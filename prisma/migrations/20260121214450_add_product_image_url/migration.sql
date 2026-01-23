-- Migration: Add product image URL support
-- Purpose: Allow products to have associated images
-- Date: 2026-01-21

-- AlterTable
ALTER TABLE "products" ADD COLUMN "imageUrl" TEXT;

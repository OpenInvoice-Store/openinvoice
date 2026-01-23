-- Migration: Add share token to invoices
-- Purpose: Enable public invoice sharing via unique tokens
-- Date: 2026-01-21
-- Impact: Allows invoices to be accessed via public URLs without authentication

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_shareToken_key" ON "invoices"("shareToken");


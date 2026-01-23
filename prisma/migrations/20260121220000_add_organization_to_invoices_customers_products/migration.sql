-- Migration: Add organization scoping to business entities
-- Purpose: Enable multi-tenant data isolation by linking invoices, customers, and products to organizations
-- Date: 2026-01-21
-- Impact: Adds organizationId columns to enable organization-based filtering

-- Add organizationId column to customers table
ALTER TABLE "customers" ADD COLUMN "organizationId" TEXT;

-- Add organizationId column to products table
ALTER TABLE "products" ADD COLUMN "organizationId" TEXT;

-- Add organizationId column to invoices table
ALTER TABLE "invoices" ADD COLUMN "organizationId" TEXT;

-- Add foreign key constraint for customers
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraint for products
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraint for invoices
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


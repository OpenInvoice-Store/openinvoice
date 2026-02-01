-- Migration: Add branding and invoice templates support
-- Purpose: Enable custom branding and multiple invoice templates
-- Date: 2026-01-28

-- AlterTable: Add branding fields to organizations
ALTER TABLE "organizations" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "organizations" ADD COLUMN "primaryColor" TEXT;
ALTER TABLE "organizations" ADD COLUMN "secondaryColor" TEXT;
ALTER TABLE "organizations" ADD COLUMN "fontFamily" TEXT;
ALTER TABLE "organizations" ADD COLUMN "companyAddress" TEXT;
ALTER TABLE "organizations" ADD COLUMN "companyPhone" TEXT;
ALTER TABLE "organizations" ADD COLUMN "companyEmail" TEXT;
ALTER TABLE "organizations" ADD COLUMN "companyWebsite" TEXT;
ALTER TABLE "organizations" ADD COLUMN "footerText" TEXT;

-- CreateTable: Invoice templates
CREATE TABLE "invoice_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "layout" TEXT,
    "headerTemplate" TEXT,
    "footerTemplate" TEXT,
    "styles" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add template reference to invoices
ALTER TABLE "invoices" ADD COLUMN "templateId" TEXT;

-- CreateIndex
CREATE INDEX "invoice_templates_organizationId_isDefault_idx" ON "invoice_templates"("organizationId", "isDefault");

-- CreateIndex
CREATE INDEX "invoice_templates_organizationId_isActive_idx" ON "invoice_templates"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "invoices_templateId_idx" ON "invoices"("templateId");

-- AddForeignKey
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "invoice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;


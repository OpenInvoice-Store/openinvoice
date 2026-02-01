-- Migration: Add recurring invoice templates
-- Purpose: Enable recurring invoices and subscription management
-- Date: 2026-01-25

-- AlterTable: Add recurring template reference to invoices
ALTER TABLE "invoices" ADD COLUMN "recurringTemplateId" TEXT;

-- CreateTable: Recurring invoice templates
CREATE TABLE "recurring_invoice_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextGenerationDate" TIMESTAMP(3) NOT NULL,
    "templateItems" TEXT NOT NULL,
    "templateNotes" TEXT,
    "daysUntilDue" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'active',
    "autoSendEmail" BOOLEAN NOT NULL DEFAULT true,
    "totalGenerated" INTEGER NOT NULL DEFAULT 0,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_organizationId_status_idx" ON "recurring_invoice_templates"("organizationId", "status");

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_status_nextGenerationDate_idx" ON "recurring_invoice_templates"("status", "nextGenerationDate");

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_customerId_idx" ON "recurring_invoice_templates"("customerId");

-- CreateIndex
CREATE INDEX "invoices_recurringTemplateId_idx" ON "invoices"("recurringTemplateId");

-- AddForeignKey
ALTER TABLE "recurring_invoice_templates" ADD CONSTRAINT "recurring_invoice_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoice_templates" ADD CONSTRAINT "recurring_invoice_templates_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_invoice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;


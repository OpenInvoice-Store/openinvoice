-- Migration: Add usage-based billing support
-- Purpose: Enable usage-based billing for recurring invoices
-- Date: 2026-01-27

-- AlterTable: Add usage-based billing fields to recurring_invoice_templates
ALTER TABLE "recurring_invoice_templates" ADD COLUMN "isUsageBased" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recurring_invoice_templates" ADD COLUMN "usageUnit" TEXT;

-- CreateTable: Usage records for tracking usage data
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "recurringTemplateId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "metadata" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_records_recurringTemplateId_periodStart_periodEnd_idx" ON "usage_records"("recurringTemplateId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "usage_records_invoiceId_idx" ON "usage_records"("invoiceId");

-- CreateIndex
CREATE INDEX "usage_records_recurringTemplateId_recordedAt_idx" ON "usage_records"("recurringTemplateId", "recordedAt");

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_invoice_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;


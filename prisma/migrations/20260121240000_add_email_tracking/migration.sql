-- Migration: Add email tracking to invoices
-- Purpose: Track email sends for invoices with detailed logs
-- Date: 2026-01-21
-- Impact: Enables email audit trail and tracking of email sends per invoice

-- Add emailSentCount column to invoices table
ALTER TABLE "invoices" ADD COLUMN "emailSentCount" INTEGER NOT NULL DEFAULT 0;

-- Create email_logs table
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "resendId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for better query performance
CREATE INDEX "email_logs_invoiceId_idx" ON "email_logs"("invoiceId");
CREATE INDEX "email_logs_sentAt_idx" ON "email_logs"("sentAt");

-- Add foreign key constraint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_invoiceId_fkey" 
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;


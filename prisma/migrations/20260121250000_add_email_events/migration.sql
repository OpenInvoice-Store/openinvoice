-- Migration: Add email events tracking for Resend webhooks
-- Purpose: Track email events like opens, clicks, bounces, etc. from Resend webhooks
-- Date: 2026-01-21
-- Impact: Enables detailed email engagement tracking

-- Add index on resendId for faster lookups
CREATE INDEX "email_logs_resendId_idx" ON "email_logs"("resendId");

-- Create email_events table
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "emailLogId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- Create indexes for better query performance
CREATE INDEX "email_events_emailLogId_idx" ON "email_events"("emailLogId");
CREATE INDEX "email_events_eventType_idx" ON "email_events"("eventType");
CREATE INDEX "email_events_occurredAt_idx" ON "email_events"("occurredAt");

-- Add foreign key constraint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_emailLogId_fkey" 
    FOREIGN KEY ("emailLogId") REFERENCES "email_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;


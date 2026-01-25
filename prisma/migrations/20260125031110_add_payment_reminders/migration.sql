-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "markedOverdueAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "invoices_status_dueDate_idx" ON "invoices"("status", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_organizationId_status_dueDate_idx" ON "invoices"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "payments_invoiceId_stripeStatus_idx" ON "payments"("invoiceId", "stripeStatus");

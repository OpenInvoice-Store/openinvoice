import { prisma } from './db';

/**
 * Apply a payment amount to installments in order (oldest first)
 * Returns the installment IDs that received payments
 */
export async function applyPaymentToInstallments(
  invoiceId: string,
  paymentId: string,
  amount: number
): Promise<string[]> {
  // Get payment plan for this invoice
  const paymentPlan = await prisma.paymentPlan.findUnique({
    where: { invoiceId },
    include: {
      installments: {
        where: {
          status: {
            in: ['pending', 'overdue']
          }
        },
        include: {
          payments: true
        },
        orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }]
      }
    }
  });

  if (!paymentPlan || paymentPlan.installments.length === 0) {
    return [];
  }

  let remainingAmount = amount;
  const updatedInstallmentIds: string[] = [];

  // Apply payment to installments in order (oldest due date first)
  for (const installment of paymentPlan.installments) {
    if (remainingAmount <= 0) break;

    const totalPaid = installment.payments.reduce(
      (sum, p) => sum + p.amount,
      0
    );
    const remaining = installment.amount - totalPaid;

    if (remaining <= 0) continue; // Already fully paid

    const amountToApply = Math.min(remainingAmount, remaining);

    // Link payment to installment
    await prisma.payment.update({
      where: { id: paymentId },
      data: { installmentId: installment.id }
    });

    // Update installment status
    const newTotalPaid = totalPaid + amountToApply;
    let newStatus = installment.status;

    if (newTotalPaid >= installment.amount) {
      newStatus = 'paid';
    } else if (installment.dueDate < new Date()) {
      newStatus = 'overdue';
    }

    await prisma.installment.update({
      where: { id: installment.id },
      data: {
        status: newStatus,
        ...(newStatus === 'paid' ? { paidAt: new Date() } : {})
      }
    });

    updatedInstallmentIds.push(installment.id);
    remainingAmount -= amountToApply;
  }

  // Check if payment plan is completed
  const allInstallments = await prisma.installment.findMany({
    where: { paymentPlanId: paymentPlan.id }
  });

  const allPaid = allInstallments.every((inst) => inst.status === 'paid');
  if (allPaid && paymentPlan.status === 'active') {
    await prisma.paymentPlan.update({
      where: { id: paymentPlan.id },
      data: { status: 'completed' }
    });
  }

  return updatedInstallmentIds;
}

/**
 * Update invoice status based on payment plan installments
 */
export async function updateInvoiceStatusFromPaymentPlan(
  invoiceId: string
): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      payments: true,
      paymentPlan: {
        include: {
          installments: true
        }
      }
    }
  });

  if (!invoice || !invoice.paymentPlan) {
    return;
  }

  // Calculate totals
  const totalAmount = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity * (1 + item.taxRate / 100),
    0
  );
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);

  // Update invoice status
  let newStatus = invoice.status;

  if (totalPaid >= totalAmount) {
    newStatus = 'paid';
  } else if (invoice.status === 'draft') {
    newStatus = 'sent';
  } else {
    // Check if any installments are overdue
    const hasOverdue = invoice.paymentPlan.installments.some(
      (inst) => inst.status === 'overdue'
    );
    if (hasOverdue && invoice.status !== 'overdue') {
      newStatus = 'overdue';
    }
  }

  if (newStatus !== invoice.status) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus }
    });
  }
}

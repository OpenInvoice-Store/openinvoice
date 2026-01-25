import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Calculate installment dates based on frequency
 */
function calculateInstallmentDates(
  startDate: Date,
  frequency: string,
  count: number
): Date[] {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  for (let i = 0; i < count; i++) {
    dates.push(new Date(currentDate));

    switch (frequency) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      default:
        // Default to monthly
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  return dates;
}

/**
 * Generate installments for a payment plan
 */
async function generateInstallments(
  tx: any, // Transaction client from Prisma
  paymentPlanId: string,
  totalAmount: number,
  installmentCount: number,
  startDate: Date,
  frequency: string
) {
  const dates = calculateInstallmentDates(
    startDate,
    frequency,
    installmentCount
  );

  // Calculate amount per installment (handle rounding)
  const baseAmount = totalAmount / installmentCount;
  const roundedAmount = Math.round(baseAmount * 100) / 100; // Round to 2 decimals
  const remainder = totalAmount - roundedAmount * installmentCount;

  const installments = dates.map((dueDate, index) => {
    // Add remainder to the last installment to account for rounding
    const amount =
      index === installmentCount - 1
        ? roundedAmount + Math.round(remainder * 100) / 100
        : roundedAmount;

    return {
      paymentPlanId,
      installmentNumber: index + 1,
      amount,
      dueDate,
      status: 'pending' as const
    };
  });

  return await tx.installment.createMany({
    data: installments
  });
}

/**
 * GET - Get payment plan for an invoice
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify invoice belongs to organization
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const paymentPlan = await prisma.paymentPlan.findUnique({
      where: { invoiceId: id },
      include: {
        installments: {
          include: {
            payments: true
          },
          orderBy: { installmentNumber: 'asc' }
        }
      }
    });

    if (!paymentPlan) {
      return NextResponse.json(null);
    }

    // Calculate status for each installment
    const now = new Date();
    const installmentsWithStatus = paymentPlan.installments.map(
      (installment) => {
        const totalPaid = installment.payments.reduce(
          (sum, p) => sum + p.amount,
          0
        );

        let status = installment.status;
        if (status === 'pending') {
          if (totalPaid >= installment.amount) {
            status = 'paid';
          } else if (installment.dueDate < now) {
            status = 'overdue';
          }
        }

        return {
          ...installment,
          status,
          totalPaid,
          remaining: installment.amount - totalPaid
        };
      }
    );

    // Update installment statuses in database
    for (const installment of installmentsWithStatus) {
      const originalInstallment = paymentPlan.installments.find(
        (inst) => inst.id === installment.id
      );
      if (
        originalInstallment &&
        installment.status !== originalInstallment.status
      ) {
        await prisma.installment.update({
          where: { id: installment.id },
          data: {
            status: installment.status,
            ...(installment.status === 'paid' &&
            installment.totalPaid >= installment.amount
              ? { paidAt: new Date() }
              : {})
          }
        });
      }
    }

    return NextResponse.json({
      ...paymentPlan,
      installments: installmentsWithStatus
    });
  } catch (error) {
    console.error('Error fetching payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment plan' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create payment plan for an invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { installmentCount, frequency, startDate } = body;

    if (!installmentCount || !frequency || !startDate) {
      return NextResponse.json(
        { error: 'Installment count, frequency, and start date are required' },
        { status: 400 }
      );
    }

    if (installmentCount < 2) {
      return NextResponse.json(
        { error: 'Installment count must be at least 2' },
        { status: 400 }
      );
    }

    // Verify invoice belongs to organization
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: {
        items: true,
        payments: true
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if payment plan already exists
    const existingPlan = await prisma.paymentPlan.findUnique({
      where: { invoiceId: id }
    });

    if (existingPlan) {
      return NextResponse.json(
        { error: 'Payment plan already exists for this invoice' },
        { status: 400 }
      );
    }

    // Calculate invoice total
    const totalAmount = invoice.items.reduce(
      (sum, item) =>
        sum + item.price * item.quantity * (1 + item.taxRate / 100),
      0
    );

    // Subtract any existing payments
    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = totalAmount - totalPaid;

    if (remainingAmount <= 0) {
      return NextResponse.json(
        { error: 'Invoice is already fully paid' },
        { status: 400 }
      );
    }

    // Create payment plan and installments in a transaction
    const paymentPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.paymentPlan.create({
        data: {
          invoiceId: id,
          totalAmount: remainingAmount,
          installmentCount,
          frequency,
          startDate: new Date(startDate),
          status: 'active'
        }
      });

      await generateInstallments(
        tx,
        plan.id,
        remainingAmount,
        installmentCount,
        new Date(startDate),
        frequency
      );

      return plan;
    });

    // Fetch the complete payment plan with installments
    const completePlan = await prisma.paymentPlan.findUnique({
      where: { id: paymentPlan.id },
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' }
        }
      }
    });

    return NextResponse.json(completePlan, { status: 201 });
  } catch (error) {
    console.error('Error creating payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to create payment plan' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update payment plan
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Verify invoice belongs to organization
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const paymentPlan = await prisma.paymentPlan.findUnique({
      where: { invoiceId: id }
    });

    if (!paymentPlan) {
      return NextResponse.json(
        { error: 'Payment plan not found' },
        { status: 404 }
      );
    }

    // Only allow status updates for now
    if (status) {
      const updated = await prisma.paymentPlan.update({
        where: { id: paymentPlan.id },
        data: { status }
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(paymentPlan);
  } catch (error) {
    console.error('Error updating payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to update payment plan' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete payment plan (only if no payments have been made)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify invoice belongs to organization
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const paymentPlan = await prisma.paymentPlan.findUnique({
      where: { invoiceId: id },
      include: {
        installments: {
          include: {
            payments: true
          }
        }
      }
    });

    if (!paymentPlan) {
      return NextResponse.json(
        { error: 'Payment plan not found' },
        { status: 404 }
      );
    }

    // Check if any payments have been made
    const hasPayments = paymentPlan.installments.some(
      (installment) => installment.payments.length > 0
    );

    if (hasPayments) {
      return NextResponse.json(
        { error: 'Cannot delete payment plan with existing payments' },
        { status: 400 }
      );
    }

    // Delete payment plan (installments will be cascade deleted)
    await prisma.paymentPlan.delete({
      where: { id: paymentPlan.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment plan' },
      { status: 500 }
    );
  }
}

import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    await prisma.payment.delete({
      where: { id },
    });

    // Recalculate invoice status
    const invoice = await prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
      include: {
        items: true,
        payments: true,
      },
    });

    if (invoice) {
      const totalAmount = invoice.items.reduce(
        (sum, item) => sum + item.price * item.quantity * (1 + item.taxRate / 100),
        0
      );
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);

      let newStatus = invoice.status;
      if (totalPaid >= totalAmount) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'sent';
      } else {
        newStatus = 'draft';
      }

      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: newStatus },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment' },
      { status: 500 }
    );
  }
}


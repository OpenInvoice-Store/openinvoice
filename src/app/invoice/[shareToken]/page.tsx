import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { InvoicePublicView } from '@/features/invoicing/components/invoice-public-view';

export const metadata = {
  title: 'Invoice',
  description: 'View invoice details'
};

export default async function PublicInvoicePage({
  params
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { shareToken },
    include: {
      customer: true,
      items: {
        include: {
          product: true
        }
      },
      payments: true,
      paymentPlan: {
        include: {
          installments: {
            include: {
              payments: true
            },
            orderBy: { installmentNumber: 'asc' }
          }
        }
      }
    } as any
  });

  if (!invoice) {
    notFound();
  }

  return <InvoicePublicView invoice={invoice} />;
}

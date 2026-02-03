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
      },
      organization: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          fontFamily: true,
          companyAddress: true,
          companyPhone: true,
          companyEmail: true,
          companyWebsite: true,
          footerText: true,
          cryptoPaymentsEnabled: true
        }
      },
      invoiceTemplate: true,
      invoiceTaxes: true
    } as any
  });

  if (!invoice) {
    notFound();
  }

  return <InvoicePublicView invoice={invoice} />;
}

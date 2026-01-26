'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/features/invoicing/hooks/use-invoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function InvoiceNotesPage() {
  const params = useParams();
  const id = params?.id as string;
  const invoiceQuery = useInvoice(id);
  const { data: invoice, isLoading } = invoiceQuery;

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!invoice) {
    return <div className='p-4'>Invoice not found</div>;
  }

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <CardTitle>Invoice Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.notes ? (
            <p className='text-sm whitespace-pre-wrap'>{invoice.notes}</p>
          ) : (
            <p className='text-muted-foreground text-sm'>
              No notes have been added for this invoice yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

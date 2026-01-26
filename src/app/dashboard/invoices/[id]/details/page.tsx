'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/features/invoicing/hooks/use-invoices';
import { formatDate, formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentPlanSection } from '@/features/invoicing/components/payment-plan-section';

export default function InvoiceDetailsPage() {
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

  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  const total = subtotal + tax;
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = total - totalPaid;

  return (
    <div className='space-y-6 p-6'>
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className='space-y-1'>
            <p className='text-sm font-semibold'>{invoice.customer?.name}</p>
            {invoice.customer?.email && (
              <p className='text-muted-foreground text-sm'>
                {invoice.customer.email}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className='space-y-1'>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Issue Date:</span>
              <span>{formatDate(invoice.issueDate)}</span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Due Date:</span>
              <span>{formatDate(invoice.dueDate)}</span>
            </div>
            {invoice.emailSentCount !== undefined &&
              invoice.emailSentCount > 0 && (
                <div className='mt-2 flex justify-between border-t pt-2 text-sm'>
                  <span className='text-muted-foreground'>Emails Sent:</span>
                  <span className='font-semibold'>
                    {invoice.emailSentCount}
                  </span>
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b'>
                  <th className='text-muted-foreground p-2 text-left font-medium'>
                    Description
                  </th>
                  <th className='text-muted-foreground p-2 text-right font-medium'>
                    Quantity
                  </th>
                  <th className='text-muted-foreground p-2 text-right font-medium'>
                    Price
                  </th>
                  <th className='text-muted-foreground p-2 text-right font-medium'>
                    Tax
                  </th>
                  <th className='text-muted-foreground p-2 text-right font-medium'>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => {
                  const itemSubtotal = item.price * item.quantity;
                  const itemTax = itemSubtotal * (item.taxRate / 100);
                  const itemTotal = itemSubtotal + itemTax;
                  return (
                    <tr key={item.id} className='border-b'>
                      <td className='p-2'>{item.description}</td>
                      <td className='p-2 text-right'>{item.quantity}</td>
                      <td className='p-2 text-right'>
                        {formatCurrency(item.price)}
                      </td>
                      <td className='p-2 text-right'>{item.taxRate}%</td>
                      <td className='p-2 text-right'>
                        {formatCurrency(itemTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className='mt-4 ml-auto w-full max-w-xs space-y-2 text-sm'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Tax:</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className='flex justify-between border-t pt-2 font-semibold'>
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className='flex justify-between text-green-600'>
                  <span className='text-muted-foreground'>Paid:</span>
                  <span>{formatCurrency(totalPaid)}</span>
                </div>
                <div className='flex justify-between border-t pt-2 font-semibold'>
                  <span>Balance:</span>
                  <span>{formatCurrency(balance)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <PaymentPlanSection
        invoiceId={id}
        invoiceTotal={total}
        totalPaid={totalPaid}
      />
    </div>
  );
}

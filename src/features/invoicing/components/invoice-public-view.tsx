'use client';

import { useState, useMemo, useCallback } from 'react';
import { formatDate } from '@/lib/format';
import { formatCurrencyAmount, getInvoiceCurrency } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IconDownload,
  IconCurrencyDollar,
  IconCalendar
} from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-gray-400'
};

interface InvoicePublicViewProps {
  invoice: any;
}

export function InvoicePublicView({ invoice }: InvoicePublicViewProps) {
  // Calculate invoice totals using utility function
  const {
    subtotal,
    manualTax,
    customTax,
    totalTax,
    total,
    totalPaid,
    balance
  } = calculateInvoiceTotals(invoice as any);

  // Get invoice taxes for display
  const invoiceTaxesRaw = (invoice as any).invoiceTaxes;
  const invoiceTaxes = Array.isArray(invoiceTaxesRaw)
    ? invoiceTaxesRaw
    : invoiceTaxesRaw
      ? [invoiceTaxesRaw]
      : [];
  const taxCalculationMethod = (invoice as any).taxCalculationMethod;

  // Get currency from invoice or organization default
  const currency = getInvoiceCurrency(
    invoice,
    invoice.organization?.defaultCurrency
  );
  // Calculate payment plan information
  const paymentPlanInfo = useMemo(() => {
    if (!invoice.paymentPlan || invoice.paymentPlan.status !== 'active') {
      return null;
    }

    const now = new Date();
    const installments = invoice.paymentPlan.installments || [];

    // Find the current installment that's due (pending or overdue)
    const currentInstallment = installments.find((inst: any) => {
      const totalPaid = (inst.payments || []).reduce(
        (sum: number, p: any) => sum + p.amount,
        0
      );
      const isFullyPaid = totalPaid >= inst.amount;
      return (
        !isFullyPaid && (inst.status === 'pending' || inst.status === 'overdue')
      );
    });

    if (!currentInstallment) {
      return null;
    }

    const installmentPaid = (currentInstallment.payments || []).reduce(
      (sum: number, p: any) => sum + p.amount,
      0
    );
    const installmentRemaining = currentInstallment.amount - installmentPaid;

    return {
      installment: currentInstallment,
      amountDue: installmentRemaining,
      installmentNumber: currentInstallment.installmentNumber,
      dueDate: currentInstallment.dueDate,
      isOverdue:
        currentInstallment.status === 'overdue' ||
        new Date(currentInstallment.dueDate) < now
    };
  }, [invoice.paymentPlan]);

  // Handle direct payment redirect to Stripe Checkout
  const handlePayNow = useCallback(async () => {
    const amountToPay = paymentPlanInfo?.amountDue || balance;

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: amountToPay
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (data.url) {
        // Open Stripe Checkout in a new tab
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create payment link');
    }
  }, [invoice.id, balance, paymentPlanInfo]);

  // Check Stripe Connect status for the organization
  const { data: stripeStatus } = useQuery({
    queryKey: ['stripe-connect-status', invoice.organizationId],
    queryFn: async () => {
      // For public view, we need to check if Stripe is connected
      // We'll make a request that doesn't require auth but checks the invoice's org
      try {
        const response = await fetch(
          `/api/invoices/${invoice.id}/stripe-status`
        );
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
    enabled: balance > 0
  });

  const handleDownloadPDF = () => {
    window.open(`/api/invoices/${invoice.id}/pdf`, '_blank');
  };

  const org = invoice.organization || {};
  const template = (invoice as any).invoiceTemplate;
  const layout = template?.layout || 'standard';
  const primaryColor = org.primaryColor || '#2563eb';
  const secondaryColor = org.secondaryColor || '#64748b';
  const footerText = org.footerText || 'Thank you for your business!';

  // Parse template styles if available
  let templateStyles: Record<string, any> = {};
  if (template?.styles) {
    try {
      templateStyles =
        typeof template.styles === 'string'
          ? JSON.parse(template.styles)
          : template.styles;
    } catch (e) {
      console.error('Failed to parse template styles:', e);
    }
  }

  // Determine container class based on layout
  const containerClass =
    layout === 'compact'
      ? 'max-w-3xl'
      : layout === 'detailed'
        ? 'max-w-5xl'
        : 'max-w-4xl';

  return (
    <div
      className='bg-background min-h-screen p-6'
      style={{ fontFamily: org.fontFamily || 'inherit' }}
    >
      <div className={`mx-auto ${containerClass} space-y-6`}>
        {/* Custom Header Template */}
        {template?.headerTemplate ? (
          <div
            className='border-b pb-6'
            dangerouslySetInnerHTML={{ __html: template.headerTemplate }}
          />
        ) : (
          /* Default Header with Logo and Branding */
          <div className='border-b pb-6'>
            {org.logoUrl && (
              <div className='mb-4'>
                <img
                  src={org.logoUrl}
                  alt={org.name || 'Company Logo'}
                  className='h-16 w-auto object-contain'
                />
              </div>
            )}
            <div className='flex items-center justify-between'>
              <div>
                <h1
                  className={
                    layout === 'compact'
                      ? 'text-2xl font-bold'
                      : 'text-3xl font-bold'
                  }
                  style={{ color: primaryColor }}
                >
                  Invoice #{invoice.invoiceNo}
                </h1>
                <Badge
                  className={`mt-2 ${statusColors[invoice.status] || 'bg-gray-500'}`}
                >
                  {invoice.status}
                </Badge>
              </div>
              <div className='flex gap-2'>
                {balance > 0 &&
                  stripeStatus?.connected &&
                  stripeStatus?.status === 'active' && (
                    <Button
                      onClick={handlePayNow}
                      style={{ backgroundColor: primaryColor }}
                      className='hover:opacity-90'
                    >
                      <IconCurrencyDollar className='mr-2 h-4 w-4' />
                      {paymentPlanInfo
                        ? `Pay Installment #${paymentPlanInfo.installmentNumber} (${formatCurrencyAmount(paymentPlanInfo.amountDue, currency)})`
                        : `Pay Now (${formatCurrencyAmount(balance, currency)})`}
                    </Button>
                  )}
                <Button
                  variant='outline'
                  onClick={handleDownloadPDF}
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <IconDownload className='mr-2 h-4 w-4' /> Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Company Information - Only show if not using custom header */}
        {!template?.headerTemplate && org.name && (
          <Card
            className={layout === 'compact' ? 'bg-muted/20' : 'bg-muted/30'}
          >
            <CardContent className={layout === 'compact' ? 'pt-4' : 'pt-6'}>
              <div
                className={`space-y-2 ${layout === 'compact' ? 'text-xs' : 'text-sm'}`}
              >
                <p
                  className={`${layout === 'compact' ? 'text-xs' : 'text-sm'} font-semibold`}
                >
                  {org.name}
                </p>
                {org.companyAddress && (
                  <p
                    className={layout === 'compact' ? 'text-xs' : 'text-sm'}
                    style={{ color: secondaryColor }}
                  >
                    {org.companyAddress}
                  </p>
                )}
                <div className='flex gap-4'>
                  {org.companyPhone && (
                    <p
                      className={layout === 'compact' ? 'text-xs' : 'text-sm'}
                      style={{ color: secondaryColor }}
                    >
                      {org.companyPhone}
                    </p>
                  )}
                  {org.companyEmail && (
                    <p
                      className={layout === 'compact' ? 'text-xs' : 'text-sm'}
                      style={{ color: secondaryColor }}
                    >
                      {org.companyEmail}
                    </p>
                  )}
                </div>
                {org.companyWebsite && (
                  <p className={layout === 'compact' ? 'text-xs' : 'text-sm'}>
                    <a
                      href={org.companyWebsite}
                      target='_blank'
                      rel='noopener noreferrer'
                      style={{ color: primaryColor }}
                      className='hover:underline'
                    >
                      {org.companyWebsite}
                    </a>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer and Invoice Details - Layout varies by template */}
        {layout === 'detailed' ? (
          <div className='grid grid-cols-3 gap-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-1'>
                <p className='text-sm font-semibold'>
                  {invoice.customer?.name}
                </p>
                {invoice.customer?.email && (
                  <p className='text-muted-foreground text-sm'>
                    {invoice.customer.email}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Invoice Details</CardTitle>
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
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>Invoice #:</span>
                  <span>{invoice.invoiceNo}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Payment Status</CardTitle>
              </CardHeader>
              <CardContent className='space-y-1'>
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>Status:</span>
                  <Badge
                    className={statusColors[invoice.status] || 'bg-gray-500'}
                  >
                    {invoice.status}
                  </Badge>
                </div>
                {totalPaid > 0 && (
                  <div className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>Paid:</span>
                    <span className='text-green-600'>
                      {formatCurrencyAmount(totalPaid, currency)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : layout === 'compact' ? (
          <div className='grid grid-cols-2 gap-3'>
            <div className='rounded-md border p-3'>
              <p className='mb-1 text-xs font-semibold'>Customer</p>
              <p className='text-xs'>{invoice.customer?.name}</p>
              {invoice.customer?.email && (
                <p className='text-muted-foreground text-xs'>
                  {invoice.customer.email}
                </p>
              )}
            </div>
            <div className='rounded-md border p-3'>
              <p className='mb-1 text-xs font-semibold'>Invoice Details</p>
              <div className='space-y-0.5 text-xs'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Issue:</span>
                  <span>{formatDate(invoice.issueDate)}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Due:</span>
                  <span>{formatDate(invoice.dueDate)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-4'>
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className='space-y-1'>
                <p className='text-sm font-semibold'>
                  {invoice.customer?.name}
                </p>
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
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className={layout === 'compact' ? 'text-base' : ''}>
              Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='rounded-md border'>
              <table
                className={`w-full ${layout === 'compact' ? 'text-xs' : 'text-sm'}`}
              >
                <thead>
                  <tr className='border-b'>
                    <th
                      className={`text-muted-foreground ${layout === 'compact' ? 'p-1.5' : 'p-2'} text-left font-medium`}
                    >
                      Description
                    </th>
                    <th
                      className={`text-muted-foreground ${layout === 'compact' ? 'p-1.5' : 'p-2'} text-right font-medium`}
                    >
                      Quantity
                    </th>
                    <th
                      className={`text-muted-foreground ${layout === 'compact' ? 'p-1.5' : 'p-2'} text-right font-medium`}
                    >
                      Price
                    </th>
                    {layout !== 'compact' && (
                      <th
                        className={`text-muted-foreground p-2 text-right font-medium`}
                      >
                        Tax
                      </th>
                    )}
                    <th
                      className={`text-muted-foreground ${layout === 'compact' ? 'p-1.5' : 'p-2'} text-right font-medium`}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item: any) => {
                    const itemSubtotal = item.price * item.quantity;
                    const itemTax = itemSubtotal * (item.taxRate / 100);
                    const itemTotal = itemSubtotal + itemTax;
                    return (
                      <tr key={item.id} className='border-b'>
                        <td className={layout === 'compact' ? 'p-1.5' : 'p-2'}>
                          {item.description}
                        </td>
                        <td
                          className={`${layout === 'compact' ? 'p-1.5' : 'p-2'} text-right`}
                        >
                          {item.quantity}
                        </td>
                        <td
                          className={`${layout === 'compact' ? 'p-1.5' : 'p-2'} text-right`}
                        >
                          {formatCurrencyAmount(item.price, currency)}
                        </td>
                        {layout !== 'compact' && (
                          <td className='p-2 text-right'>{item.taxRate}%</td>
                        )}
                        <td
                          className={`${layout === 'compact' ? 'p-1.5' : 'p-2'} text-right`}
                        >
                          {formatCurrencyAmount(itemTotal, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className={`mt-4 ml-auto ${layout === 'compact' ? 'w-48 space-y-1 text-xs' : layout === 'detailed' ? 'w-80 space-y-2 text-sm' : 'w-64 space-y-2 text-sm'}`}
            >
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Subtotal:</span>
                <span className='font-medium'>
                  {formatCurrencyAmount(subtotal, currency)}
                </span>
              </div>

              {/* Tax Breakdown Section */}
              {(manualTax > 0 ||
                customTax > 0 ||
                (invoiceTaxes && invoiceTaxes.length > 0) ||
                taxCalculationMethod) && (
                <div className='space-y-1 border-t pt-2'>
                  {manualTax > 0 && (
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>Manual Tax:</span>
                      <span>{formatCurrencyAmount(manualTax, currency)}</span>
                    </div>
                  )}
                  {invoiceTaxes && invoiceTaxes.length > 0 ? (
                    <>
                      {invoiceTaxes.map((tax: any, index: number) => (
                        <div
                          key={tax?.id || index}
                          className='flex justify-between'
                        >
                          <span className='text-muted-foreground flex items-center gap-1.5'>
                            <span>{tax?.name || 'Tax'}</span>
                            {tax?.rate !== undefined && (
                              <span className='text-xs'>({tax.rate}%)</span>
                            )}
                          </span>
                          <span className='font-medium'>
                            {formatCurrencyAmount(tax?.amount || 0, currency)}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : taxCalculationMethod &&
                    taxCalculationMethod !== 'manual' ? (
                    <div className='text-muted-foreground text-sm italic'>
                      Tax profile selected but no taxes calculated.
                    </div>
                  ) : null}
                  {totalTax > 0 && (
                    <div className='mt-1 flex justify-between border-t pt-1'>
                      <span className='text-muted-foreground font-medium'>
                        Total Tax:
                      </span>
                      <span className='font-medium'>
                        {formatCurrencyAmount(totalTax, currency)}
                      </span>
                    </div>
                  )}
                  {totalTax === 0 &&
                    (!taxCalculationMethod ||
                      taxCalculationMethod === 'manual') && (
                      <div className='flex justify-between'>
                        <span className='text-muted-foreground'>Tax:</span>
                        <span className='text-muted-foreground'>
                          {formatCurrencyAmount(0, currency)}
                        </span>
                      </div>
                    )}
                </div>
              )}
              <div
                className={`flex justify-between border-t ${layout === 'compact' ? 'pt-1' : 'pt-2'} font-semibold`}
                style={{ borderColor: primaryColor }}
              >
                <span style={{ color: primaryColor }}>Total:</span>
                <span style={{ color: primaryColor }}>
                  {formatCurrencyAmount(total, currency)}
                </span>
              </div>
              {totalPaid > 0 && (
                <>
                  <div className='flex justify-between text-green-600'>
                    <span className='text-muted-foreground'>Paid:</span>
                    <span>{formatCurrencyAmount(totalPaid, currency)}</span>
                  </div>
                  <div className='flex justify-between border-t pt-2 font-semibold'>
                    <span>Balance:</span>
                    <span>{formatCurrencyAmount(balance, currency)}</span>
                  </div>
                </>
              )}
              {paymentPlanInfo && (
                <div className='mt-2 border-t pt-2 text-sm'>
                  <div className='text-muted-foreground mb-1 text-xs'>
                    Payment Plan - Installment #
                    {paymentPlanInfo.installmentNumber}
                  </div>
                  <div className='flex justify-between font-semibold'>
                    <span>Amount Due:</span>
                    <span
                      className={
                        paymentPlanInfo.isOverdue ? 'text-red-600' : ''
                      }
                    >
                      {formatCurrencyAmount(
                        paymentPlanInfo.amountDue,
                        currency
                      )}
                    </span>
                  </div>
                  <div className='text-muted-foreground mt-1 text-xs'>
                    Due: {formatDate(paymentPlanInfo.dueDate)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {invoice.paymentPlan && invoice.paymentPlan.status === 'active' && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  <div>
                    <span className='text-muted-foreground'>Frequency:</span>
                    <p className='font-medium'>
                      {invoice.paymentPlan.frequency === 'weekly'
                        ? 'Weekly'
                        : invoice.paymentPlan.frequency === 'biweekly'
                          ? 'Bi-weekly'
                          : invoice.paymentPlan.frequency === 'monthly'
                            ? 'Monthly'
                            : 'Quarterly'}
                    </p>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Installments:</span>
                    <p className='font-medium'>
                      {invoice.paymentPlan.installmentCount}
                    </p>
                  </div>
                </div>
                {paymentPlanInfo && (
                  <div className='border-t pt-4'>
                    <div className='bg-muted/40 flex items-center justify-between rounded-lg p-3'>
                      <div>
                        <div className='text-sm font-semibold'>
                          Installment #{paymentPlanInfo.installmentNumber}
                        </div>
                        <div className='text-muted-foreground mt-1 flex items-center gap-1 text-sm'>
                          <IconCalendar className='h-3 w-3' />
                          Due: {formatDate(paymentPlanInfo.dueDate)}
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='text-sm font-semibold'>
                          {formatCurrencyAmount(
                            paymentPlanInfo.amountDue,
                            currency
                          )}
                        </div>
                        {paymentPlanInfo.isOverdue && (
                          <Badge className='mt-1 bg-red-500 text-xs'>
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm'>{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Custom Footer Template */}
        {template?.footerTemplate ? (
          <div
            className='border-t pt-6'
            style={{ borderColor: secondaryColor }}
            dangerouslySetInnerHTML={{ __html: template.footerTemplate }}
          />
        ) : (
          /* Default Footer with Branding */
          footerText && (
            <div
              className={`border-t ${layout === 'compact' ? 'pt-4' : 'pt-6'} text-center`}
              style={{ borderColor: secondaryColor }}
            >
              <p
                className={layout === 'compact' ? 'text-xs' : 'text-sm'}
                style={{ color: secondaryColor }}
              >
                {footerText}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

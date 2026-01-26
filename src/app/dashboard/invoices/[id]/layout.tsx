'use client';

import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { useInvoice } from '@/features/invoicing/hooks/use-invoices';
import { formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IconEdit,
  IconDownload,
  IconLink,
  IconMail,
  IconCurrencyDollar,
  IconBell
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { invoiceNavItems } from '@/config/invoice-nav-config';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-gray-400'
};

export default function InvoiceDetailLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id as string;
  const invoiceQuery = useInvoice(id);
  const { data: invoice, isLoading } = invoiceQuery;
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Check Stripe Connect status
  const { data: stripeStatus } = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: async () => {
      const response = await fetch('/api/stripe/connect/status');
      if (!response.ok) return null;
      return response.json();
    }
  });

  // Fetch email logs for badge counts
  const { data: emailLogs = [] } = useQuery({
    queryKey: ['emailLogs', id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}/email-logs`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  const handleDownloadPDF = () => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  const handleShareLink = async () => {
    try {
      setIsGeneratingLink(true);
      const response = await fetch(`/api/invoices/${id}/share`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const { shareUrl } = await response.json();
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Shareable link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to generate share link');
      console.error('Error generating share link:', error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice?.customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }

    try {
      setIsSendingEmail(true);
      const response = await fetch(`/api/invoices/${id}/send-email`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      toast.success('Invoice email sent successfully!');
      invoiceQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send email'
      );
      console.error('Error sending email:', error);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendReminder = async () => {
    if (!invoice?.customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }

    if (invoice.status === 'paid') {
      toast.error('Cannot send reminder for a paid invoice');
      return;
    }

    try {
      setIsSendingReminder(true);
      const response = await fetch(`/api/invoices/${id}/send-reminder`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send reminder');
      }

      toast.success('Payment reminder sent successfully!');
      invoiceQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send reminder'
      );
      console.error('Error sending reminder:', error);
    } finally {
      setIsSendingReminder(false);
    }
  };

  if (isLoading) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='text-center'>
          <div className='text-muted-foreground'>Loading invoice...</div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='text-center'>
          <h2 className='text-2xl font-semibold'>Invoice Not Found</h2>
          <p className='text-muted-foreground mt-2'>
            The invoice you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
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

  // Get current section from pathname
  // Pathname will be like /dashboard/invoices/[id]/details
  const pathParts = pathname?.split('/').filter(Boolean) || [];
  const lastPart = pathParts[pathParts.length - 1];
  // If last part is the invoice id (numeric or matches our id), default to 'details'
  const currentSection =
    lastPart === id || !invoiceNavItems.some((item) => item.href === lastPart)
      ? 'details'
      : lastPart;

  // Helper function to get badge count
  const getBadgeCount = (badgeKey?: string): number | null => {
    if (!badgeKey) return null;
    if (badgeKey === 'payments.length') return invoice.payments.length;
    if (badgeKey === 'emailLogs.length') return emailLogs.length;
    if (badgeKey === 'reminderCount') return invoice.reminderCount ?? 0;
    return null;
  };

  return (
    <div className='space-y-0'>
      {/* Header with Invoice info on left and actions on right */}
      <div className='flex items-center justify-between border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <h2 className='text-2xl font-bold'>Invoice #{invoice.invoiceNo}</h2>
          <Badge className={`${statusColors[invoice.status] || 'bg-gray-500'}`}>
            {invoice.status}
          </Badge>
        </div>
        <div className='flex flex-wrap gap-2'>
          {balance > 0 &&
            stripeStatus?.connected &&
            stripeStatus?.status === 'active' && (
              <Button
                variant='default'
                asChild
                className='bg-green-600 hover:bg-green-700'
              >
                <Link href={`/dashboard/invoices/${id}/payments`}>
                  <IconCurrencyDollar className='mr-2 h-4 w-4' />
                  Pay Now
                </Link>
              </Button>
            )}
          {invoice.customer?.email && (
            <>
              <Button
                variant='default'
                onClick={handleSendEmail}
                disabled={isSendingEmail}
              >
                <IconMail className='mr-2 h-4 w-4' />
                {isSendingEmail ? 'Sending...' : 'Send Email'}
              </Button>
              {invoice.status !== 'paid' && (
                <Button
                  variant='outline'
                  onClick={handleSendReminder}
                  disabled={isSendingReminder}
                >
                  <IconBell className='mr-2 h-4 w-4' />
                  {isSendingReminder ? 'Sending...' : 'Send Reminder'}
                </Button>
              )}
            </>
          )}
          <Button
            variant='outline'
            onClick={handleShareLink}
            disabled={isGeneratingLink}
          >
            <IconLink className='mr-2 h-4 w-4' />
            {isGeneratingLink ? 'Generating...' : 'Share Link'}
          </Button>
          <Button variant='outline' onClick={handleDownloadPDF}>
            <IconDownload className='mr-2 h-4 w-4' /> Download PDF
          </Button>
          <Button variant='outline' asChild>
            <Link href={`/dashboard/invoices/${id}/edit`}>
              <IconEdit className='mr-2 h-4 w-4' /> Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Main layout: left sidebar + right content */}
      <div className='flex min-h-[calc(100vh-12rem)] gap-6'>
        {/* Left Sidebar Navigation */}
        <aside className='bg-background w-64 shrink-0 border-r'>
          <div className='p-6'>
            <h3 className='text-muted-foreground mb-6 text-xs font-semibold tracking-wide uppercase'>
              Sections
            </h3>
            <nav className='space-y-1'>
              {invoiceNavItems.map((item) => {
                const Icon = item.icon;
                const href = `/dashboard/invoices/${id}/${item.href}`;
                const isActive = currentSection === item.href;
                const badgeCount = getBadgeCount(item.badgeKey);

                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <Icon className='h-4 w-4' />
                    <span className='flex-1'>{item.title}</span>
                    {badgeCount !== null && badgeCount > 0 && (
                      <span
                        className={cn(
                          'ml-auto rounded-full px-2 text-xs font-medium',
                          item.href === 'payments' &&
                            'bg-emerald-100 text-emerald-700',
                          item.href === 'emails' && 'bg-blue-100 text-blue-700',
                          item.href === 'reminders' &&
                            'bg-orange-100 text-orange-700'
                        )}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className='flex-1 overflow-auto'>{children}</main>
      </div>
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { useRecurringInvoice } from '@/features/invoicing/hooks/use-recurring-invoices';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { UsageRecordForm } from '@/features/invoicing/components/usage-record-form';
import { UsageHistory } from '@/features/invoicing/components/usage-history';

export default function RecurringInvoiceUsagePage() {
  const params = useParams();
  const id = params?.id as string;
  const templateQuery = useRecurringInvoice(id);
  const { data: template, isLoading } = templateQuery;

  if (isLoading) {
    return <div className='text-muted-foreground p-4 text-sm'>Loading...</div>;
  }

  if (!template) {
    return (
      <div className='text-muted-foreground p-4 text-sm'>
        Template not found
      </div>
    );
  }

  if (!template.isUsageBased) {
    return (
      <div className='p-6'>
        <Card>
          <CardContent className='pt-6'>
            <p className='text-muted-foreground text-sm'>
              This template is not configured for usage-based billing.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Usage Management</CardTitle>
              <CardDescription>
                Record and view usage data for this billing template
              </CardDescription>
            </div>
            <UsageRecordForm
              templateId={template.id}
              usageUnit={template.usageUnit}
            />
          </div>
        </CardHeader>
      </Card>
      <UsageHistory templateId={template.id} usageUnit={template.usageUnit} />
    </div>
  );
}

'use client';

import PageContainer from '@/components/layout/page-container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useOrganization } from '@clerk/nextjs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function SubscriptionSettingsPage() {
  const { organization, isLoaded } = useOrganization();

  return (
    <PageContainer
      isloading={!isLoaded}
      access={!!organization}
      accessFallback={
        <div className='flex min-h-[400px] items-center justify-center'>
          <div className='space-y-2 text-center'>
            <h2 className='text-2xl font-semibold'>No Organization Selected</h2>
            <p className='text-muted-foreground'>
              Please select or create an organization to view settings.
            </p>
          </div>
        </div>
      }
      pageTitle='Subscription'
      pageDescription="Manage your organization's subscription and usage limits"
    >
      <div className='space-y-6 p-6'>
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
            <CardDescription>
              Manage your organization's subscription and usage limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className='h-4 w-4' />
              <AlertDescription>
                Subscription management through Clerk Billing is available.
                Contact support for subscription management.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

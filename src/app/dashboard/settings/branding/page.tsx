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
import { Button } from '@/components/ui/button';
import { BrandingSettings } from '@/features/invoicing/components/branding-settings';

export default function BrandingSettingsPage() {
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
      pageTitle='Branding'
      pageDescription='Customize your invoice branding and appearance'
    >
      <div className='space-y-6 p-6'>
        <BrandingSettings />
        <Card>
          <CardHeader>
            <CardTitle>Invoice Templates</CardTitle>
            <CardDescription>
              Create and manage custom invoice templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant='outline'>
              <a href='/dashboard/settings/templates'>Manage Templates</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

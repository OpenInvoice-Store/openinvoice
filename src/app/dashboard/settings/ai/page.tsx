'use client';

import PageContainer from '@/components/layout/page-container';
import { useOrganization } from '@clerk/nextjs';
import { AISettings } from '@/features/invoicing/components/ai-settings';

export default function AISettingsPage() {
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
      pageTitle='AI Configuration'
      pageDescription='Configure AI features and API keys for your organization'
    >
      <div className='space-y-6 p-6'>
        <AISettings />
      </div>
    </PageContainer>
  );
}

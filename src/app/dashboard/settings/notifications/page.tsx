'use client';

import PageContainer from '@/components/layout/page-container';
import { useOrganization } from '@clerk/nextjs';
import { NotificationSettings } from '@/features/invoicing/components/notification-settings';

export default function NotificationSettingsPage() {
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
      pageTitle='Notifications'
      pageDescription='Configure SMS and Email notification settings'
    >
      <div className='space-y-6 p-6'>
        <NotificationSettings />
      </div>
    </PageContainer>
  );
}

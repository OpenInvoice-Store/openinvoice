'use client';

import PageContainer from '@/components/layout/page-container';
import { useOrganization } from '@clerk/nextjs';
import { TemplateManagement } from '@/features/invoicing/components/template-management';

export default function TemplatesPage() {
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
      pageTitle='Invoice Templates'
      pageDescription='Create and manage custom invoice templates'
    >
      <div className='p-6'>
        <TemplateManagement />
      </div>
    </PageContainer>
  );
}

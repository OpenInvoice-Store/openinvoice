'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useOrganization } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { settingsNavItems } from '@/config/settings-nav-config';

export default function SettingsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { organization, isLoaded } = useOrganization();

  if (!isLoaded) {
    return (
      <div className='flex h-full min-h-[calc(100vh-4rem)]'>
        <aside className='bg-background w-64 shrink-0 border-r'>
          <div className='p-6'>
            <div className='bg-muted mb-6 h-6 w-24 animate-pulse rounded' />
            <nav className='space-y-1'>
              {settingsNavItems.map((item) => (
                <div
                  key={item.href}
                  className='bg-muted h-10 w-full animate-pulse rounded-lg'
                />
              ))}
            </nav>
          </div>
        </aside>
        <main className='flex-1' />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className='flex h-full min-h-[calc(100vh-4rem)]'>
        <aside className='bg-background w-64 shrink-0 border-r'>
          <div className='p-6'>
            <h2 className='mb-6 text-lg font-semibold'>Settings</h2>
            <nav className='space-y-1'>
              {settingsNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.href}
                    className='text-muted-foreground flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium opacity-50'
                  >
                    <Icon className='h-4 w-4' />
                    <span>{item.title}</span>
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className='flex flex-1 items-center justify-center'>
          <div className='space-y-2 text-center'>
            <h2 className='text-2xl font-semibold'>No Organization Selected</h2>
            <p className='text-muted-foreground'>
              Please select or create an organization to view settings.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='flex h-full min-h-[calc(100vh-4rem)]'>
      {/* Left Sidebar Navigation */}
      <aside className='bg-background w-64 shrink-0 border-r'>
        <div className='p-6'>
          <h2 className='mb-6 text-lg font-semibold'>Settings</h2>
          <nav className='space-y-1'>
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <Icon className='h-4 w-4' />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className='flex-1 overflow-auto'>{children}</main>
    </div>
  );
}

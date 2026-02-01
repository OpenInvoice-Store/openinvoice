'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { reportsNavItems } from '@/config/reports-nav-config';

export default function ReportsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className='flex h-full min-h-[calc(100vh-4rem)]'>
      {/* Left Sidebar Navigation */}
      <aside className='bg-background w-64 shrink-0 border-r'>
        <div className='p-6'>
          <h2 className='mb-6 text-lg font-semibold'>Advanced Analytics</h2>
          <nav className='space-y-1'>
            {reportsNavItems.map((item) => {
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

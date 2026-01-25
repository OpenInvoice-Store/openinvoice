import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Shield,
  Zap,
  BarChart3,
  Users,
  Mail,
  Github,
  CreditCard,
  Package,
  Kanban,
  Bell,
  Building2,
  Receipt,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';

export default async function Page() {
  const { userId } = await auth();

  if (userId) {
    return redirect('/dashboard/overview');
  }

  return (
    <div className='flex h-screen flex-col overflow-y-auto'>
      {/* Header */}
      <header className='bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex h-16 items-center justify-between'>
            <div className='flex items-center gap-2'>
              <FileText className='text-primary h-6 w-6' />
              <span className='text-xl font-semibold'>Open Invoice</span>
            </div>
            <nav className='flex items-center gap-4'>
              <a
                href='https://github.com/usaikoo/openinvoice.git'
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors'
              >
                <Github className='h-4 w-4' />
                GitHub
              </a>
              <Link
                href='/terms'
                className='text-muted-foreground hover:text-foreground text-sm transition-colors'
              >
                Terms
              </Link>
              <Link
                href='/privacy'
                className='text-muted-foreground hover:text-foreground text-sm transition-colors'
              >
                Privacy
              </Link>
              <Button asChild variant='outline' size='sm'>
                <Link href='/auth/sign-in'>Sign In</Link>
              </Button>
              <Button asChild size='sm'>
                <Link href='/auth/sign-up'>Get Started</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className='flex-1'>
        <section className='container mx-auto px-4 py-24 sm:px-6 sm:py-32 lg:px-8'>
          <div className='mx-auto max-w-4xl text-center'>
            <h1 className='mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl'>
              Modern Invoice Management
              <span className='text-primary mt-2 block'>Made Simple</span>
            </h1>
            <p className='text-muted-foreground mx-auto mb-8 max-w-2xl text-lg sm:text-xl'>
              Create, manage, and track invoices effortlessly. Accept online
              payments, automate reminders, and gain insights with analytics.
              Open source invoice management built for businesses of all sizes.
            </p>
            <div className='flex flex-col justify-center gap-4 sm:flex-row'>
              <Button asChild size='lg' className='text-base'>
                <Link href='/auth/sign-up'>Get Started</Link>
              </Button>
              <Button asChild size='lg' variant='outline' className='text-base'>
                <a
                  href='https://github.com/usaikoo/openinvoice.git'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-2'
                >
                  <Github className='h-5 w-5' />
                  View on GitHub
                </a>
              </Button>
              <Button asChild size='lg' variant='outline' className='text-base'>
                <Link href='/auth/sign-in'>Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className='container mx-auto px-4 py-16 sm:px-6 sm:py-24 lg:px-8'>
          <div className='mx-auto max-w-6xl'>
            <h2 className='mb-4 text-center text-3xl font-bold'>
              Everything you need to manage invoices
            </h2>
            <p className='text-muted-foreground mb-12 text-center text-lg'>
              Powerful features to streamline your invoicing workflow
            </p>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
              <div className='bg-card rounded-lg border p-6'>
                <FileText className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>
                  Invoice Management
                </h3>
                <p className='text-muted-foreground'>
                  Create, edit, and manage invoices with automatic numbering,
                  status tracking, and professional PDF generation.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <CreditCard className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>Online Payments</h3>
                <p className='text-muted-foreground'>
                  Accept payments via Stripe Connect with support for cards,
                  ACH, bank transfers, partial payments, and saved payment
                  methods.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Users className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>
                  Customer Management
                </h3>
                <p className='text-muted-foreground'>
                  Keep track of all your customers with detailed contact
                  information, invoice history, and payment method preferences.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Package className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>Product Catalog</h3>
                <p className='text-muted-foreground'>
                  Maintain a catalog of products and services with pricing, tax
                  rates, and images for quick invoice creation.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <BarChart3 className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>
                  Analytics Dashboard
                </h3>
                <p className='text-muted-foreground'>
                  Visual insights with revenue charts, invoice status
                  distribution, and sales performance analytics.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Kanban className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>Kanban Board</h3>
                <p className='text-muted-foreground'>
                  Visual invoice workflow management with drag-and-drop between
                  status columns for better organization.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Mail className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>Email Tracking</h3>
                <p className='text-muted-foreground'>
                  Send invoices via email with real-time tracking of opens,
                  clicks, delivery status, and complete engagement metrics.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Bell className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>
                  Payment Reminders
                </h3>
                <p className='text-muted-foreground'>
                  Automated payment reminders for upcoming, due, and overdue
                  invoices with configurable schedules and retry logic.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Receipt className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>Payment Receipts</h3>
                <p className='text-muted-foreground'>
                  Generate professional PDF receipts for each payment with
                  complete payment history and tracking.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Zap className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>
                  Shareable Invoices
                </h3>
                <p className='text-muted-foreground'>
                  Generate secure, shareable links for your clients to view and
                  pay invoices online with automatic status updates.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Building2 className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>
                  Multi-Tenant Workspaces
                </h3>
                <p className='text-muted-foreground'>
                  Organize invoices by workspace with team collaboration,
                  role-based access control, and organization-level billing.
                </p>
              </div>
              <div className='bg-card rounded-lg border p-6'>
                <Shield className='text-primary mb-4 h-8 w-8' />
                <h3 className='mb-2 text-xl font-semibold'>
                  Secure & Reliable
                </h3>
                <p className='text-muted-foreground'>
                  Enterprise-grade authentication with Clerk, PCI-compliant
                  payments, and comprehensive security measures.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Coming Soon Section */}
        <section className='bg-muted/50 border-y'>
          <div className='container mx-auto px-4 py-16 sm:px-6 sm:py-24 lg:px-8'>
            <div className='mx-auto max-w-4xl'>
              <h2 className='mb-4 text-center text-3xl font-bold'>
                Coming Soon
              </h2>
              <p className='text-muted-foreground mb-8 text-center text-lg'>
                Exciting features on our roadmap
              </p>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='bg-background rounded-lg border p-4'>
                  <div className='flex items-start gap-3'>
                    <TrendingUp className='text-primary mt-1 h-5 w-5 flex-shrink-0' />
                    <div>
                      <h3 className='mb-1 font-semibold'>Recurring Invoices</h3>
                      <p className='text-muted-foreground text-sm'>
                        Automated recurring invoices and subscription management
                      </p>
                    </div>
                  </div>
                </div>
                <div className='bg-background rounded-lg border p-4'>
                  <div className='flex items-start gap-3'>
                    <CheckCircle2 className='text-primary mt-1 h-5 w-5 flex-shrink-0' />
                    <div>
                      <h3 className='mb-1 font-semibold'>
                        Branding & Templates
                      </h3>
                      <p className='text-muted-foreground text-sm'>
                        Custom branding, invoice templates, and branded email
                        templates
                      </p>
                    </div>
                  </div>
                </div>
                <div className='bg-background rounded-lg border p-4'>
                  <div className='flex items-start gap-3'>
                    <TrendingUp className='text-primary mt-1 h-5 w-5 flex-shrink-0' />
                    <div>
                      <h3 className='mb-1 font-semibold'>Multi-Currency</h3>
                      <p className='text-muted-foreground text-sm'>
                        Support for multiple currencies and international
                        payments
                      </p>
                    </div>
                  </div>
                </div>
                <div className='bg-background rounded-lg border p-4'>
                  <div className='flex items-start gap-3'>
                    <BarChart3 className='text-primary mt-1 h-5 w-5 flex-shrink-0' />
                    <div>
                      <h3 className='mb-1 font-semibold'>Advanced Analytics</h3>
                      <p className='text-muted-foreground text-sm'>
                        Custom report builder, financial forecasting, and export
                        capabilities
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className='bg-muted/50 border-t'>
        <div className='container mx-auto px-4 py-8 sm:px-6 lg:px-8'>
          <div className='flex flex-col items-center justify-between gap-4 sm:flex-row'>
            <div className='flex items-center gap-2'>
              <FileText className='text-primary h-5 w-5' />
              <span className='text-sm font-medium'>Open Invoice</span>
            </div>
            <div className='text-muted-foreground flex items-center gap-6 text-sm'>
              <Link
                href='/terms'
                className='hover:text-foreground transition-colors'
              >
                Terms of Service
              </Link>
              <Link
                href='/privacy'
                className='hover:text-foreground transition-colors'
              >
                Privacy Policy
              </Link>
              <a
                href='https://github.com/usaikoo/openinvoice.git'
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-foreground transition-colors'
              >
                GitHub
              </a>
            </div>
          </div>
          <div className='text-muted-foreground mt-4 text-center text-sm'>
            <p>
              © {new Date().getFullYear()} Open Invoice. Open source invoice
              management.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

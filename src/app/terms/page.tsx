import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | Open Invoice',
  description: 'Terms of Service for Open Invoice'
};

export default function TermsPage() {
  return (
    <div className='flex h-screen flex-col overflow-y-auto'>
      {/* Header */}
      <header className='bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex h-16 items-center justify-between'>
            <Link href='/' className='flex items-center gap-2'>
              <FileText className='text-primary h-6 w-6' />
              <span className='text-xl font-semibold'>Open Invoice</span>
            </Link>
            <Button asChild variant='outline' size='sm'>
              <Link href='/auth/sign-in'>Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className='container mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8'>
        <div className='max-w-none'>
          <h1 className='mb-2 text-4xl font-bold'>Terms of Service</h1>
          <p className='text-muted-foreground mb-8'>
            Last updated:{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              1. Acceptance of Terms
            </h2>
            <p className='text-muted-foreground mb-4'>
              By accessing and using Open Invoice, you accept and agree to be
              bound by the terms and provision of this agreement. If you do not
              agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>2. Use License</h2>
            <p className='text-muted-foreground mb-4'>
              Permission is granted to temporarily use Open Invoice for personal
              and commercial purposes. This is the grant of a license, not a
              transfer of title, and under this license you may not:
            </p>
            <ul className='text-muted-foreground list-disc space-y-2 pl-6'>
              <li>Modify or copy the materials</li>
              <li>
                Use the materials for any commercial purpose or for any public
                display
              </li>
              <li>
                Attempt to reverse engineer any software contained in Open
                Invoice
              </li>
              <li>
                Remove any copyright or other proprietary notations from the
                materials
              </li>
            </ul>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              3. Service Availability
            </h2>
            <p className='text-muted-foreground mb-4'>
              We strive to provide a reliable service, but we do not guarantee
              that the service will be available at all times. We may experience
              downtime due to maintenance, updates, or unforeseen circumstances.
              We are not liable for any loss or damage resulting from service
              unavailability.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>4. User Accounts</h2>
            <p className='text-muted-foreground mb-4'>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activities that occur under your
              account. You agree to notify us immediately of any unauthorized
              use of your account.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>5. Data and Privacy</h2>
            <p className='text-muted-foreground mb-4'>
              Your use of Open Invoice is also governed by our Privacy Policy.
              Please review our Privacy Policy to understand our practices
              regarding the collection and use of your data.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>6. Prohibited Uses</h2>
            <p className='text-muted-foreground mb-4'>
              You may not use Open Invoice:
            </p>
            <ul className='text-muted-foreground list-disc space-y-2 pl-6'>
              <li>In any way that violates any applicable law or regulation</li>
              <li>To transmit any malicious code or viruses</li>
              <li>To engage in any fraudulent or illegal activity</li>
              <li>To infringe upon the rights of others</li>
            </ul>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              7. Limitation of Liability
            </h2>
            <p className='text-muted-foreground mb-4'>
              In no event shall Open Invoice or its suppliers be liable for any
              damages (including, without limitation, damages for loss of data
              or profit, or due to business interruption) arising out of the use
              or inability to use Open Invoice, even if we have been notified
              orally or in writing of the possibility of such damage.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>8. Changes to Terms</h2>
            <p className='text-muted-foreground mb-4'>
              We reserve the right to modify these terms at any time. We will
              notify users of any material changes by posting the new Terms of
              Service on this page. Your continued use of the service after such
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              9. Contact Information
            </h2>
            <p className='text-muted-foreground mb-4'>
              If you have any questions about these Terms of Service, please
              contact us through our{' '}
              <a
                href='https://github.com/usaikoo/openinvoice.store'
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:underline'
              >
                GitHub repository
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className='bg-muted/50 mt-auto border-t'>
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
                href='https://github.com/usaikoo/openinvoice.store'
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-foreground transition-colors'
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

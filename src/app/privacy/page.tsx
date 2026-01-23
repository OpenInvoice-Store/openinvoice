import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | Open Invoice',
  description: 'Privacy Policy for Open Invoice'
};

export default function PrivacyPage() {
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
          <h1 className='mb-2 text-4xl font-bold'>Privacy Policy</h1>
          <p className='text-muted-foreground mb-8'>
            Last updated:{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>1. Introduction</h2>
            <p className='text-muted-foreground mb-4'>
              Open Invoice (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
              is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our invoice management service.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              2. Information We Collect
            </h2>
            <h3 className='mt-4 mb-3 text-xl font-semibold'>
              2.1 Account Information
            </h3>
            <p className='text-muted-foreground mb-4'>
              When you create an account, we collect information such as your
              name, email address, and authentication credentials. This
              information is managed through our authentication provider, Clerk.
            </p>
            <h3 className='mt-4 mb-3 text-xl font-semibold'>
              2.2 Business Data
            </h3>
            <p className='text-muted-foreground mb-4'>
              We store the data you create and manage within Open Invoice,
              including:
            </p>
            <ul className='text-muted-foreground list-disc space-y-2 pl-6'>
              <li>Customer information and contact details</li>
              <li>Invoice data, line items, and payment records</li>
              <li>Product and service catalogs</li>
              <li>Email communication logs and tracking data</li>
            </ul>
            <h3 className='mt-4 mb-3 text-xl font-semibold'>2.3 Usage Data</h3>
            <p className='text-muted-foreground mb-4'>
              We may collect information about how you access and use Open
              Invoice, including your IP address, browser type, device
              information, and usage patterns.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              3. How We Use Your Information
            </h2>
            <p className='text-muted-foreground mb-4'>
              We use the information we collect to:
            </p>
            <ul className='text-muted-foreground list-disc space-y-2 pl-6'>
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send invoices and communications to your customers</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>
                Monitor and analyze usage patterns to improve user experience
              </li>
              <li>
                Detect, prevent, and address technical issues and security
                threats
              </li>
            </ul>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              4. Data Storage and Security
            </h2>
            <p className='text-muted-foreground mb-4'>
              We implement appropriate technical and organizational measures to
              protect your data against unauthorized access, alteration,
              disclosure, or destruction. Your data is stored securely in our
              database and is encrypted in transit and at rest.
            </p>
            <p className='text-muted-foreground mb-4'>
              However, no method of transmission over the Internet or electronic
              storage is 100% secure. While we strive to use commercially
              acceptable means to protect your data, we cannot guarantee
              absolute security.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              5. Third-Party Services
            </h2>
            <p className='text-muted-foreground mb-4'>
              We use the following third-party services that may have access to
              certain information:
            </p>
            <ul className='text-muted-foreground list-disc space-y-2 pl-6'>
              <li>
                <strong>Clerk:</strong> For authentication and user management.
                Their privacy policy governs how they handle your authentication
                data.
              </li>
              <li>
                <strong>Resend:</strong> For sending transactional emails. Email
                content and recipient information are processed by Resend.
              </li>
              <li>
                <strong>Database Provider:</strong> Your data is stored in a
                secure PostgreSQL database hosted by our infrastructure
                provider.
              </li>
            </ul>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>6. Data Retention</h2>
            <p className='text-muted-foreground mb-4'>
              We retain your data for as long as your account is active or as
              needed to provide you with our services. If you delete your
              account, we will delete or anonymize your data in accordance with
              applicable laws and regulations, unless we are required to retain
              it for legal purposes.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>7. Your Rights</h2>
            <p className='text-muted-foreground mb-4'>
              Depending on your location, you may have certain rights regarding
              your personal data, including:
            </p>
            <ul className='text-muted-foreground list-disc space-y-2 pl-6'>
              <li>The right to access your personal data</li>
              <li>The right to correct inaccurate data</li>
              <li>The right to delete your data</li>
              <li>The right to restrict or object to processing</li>
              <li>The right to data portability</li>
            </ul>
            <p className='text-muted-foreground mt-4 mb-4'>
              To exercise these rights, please contact us through our{' '}
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

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              8. Cookies and Tracking
            </h2>
            <p className='text-muted-foreground mb-4'>
              We use cookies and similar tracking technologies to maintain your
              session, remember your preferences, and analyze usage. You can
              control cookies through your browser settings, but disabling
              cookies may limit your ability to use certain features of our
              service.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              9. Children&apos;s Privacy
            </h2>
            <p className='text-muted-foreground mb-4'>
              Open Invoice is not intended for users under the age of 18. We do
              not knowingly collect personal information from children. If you
              believe we have collected information from a child, please contact
              us immediately.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>
              10. Changes to This Privacy Policy
            </h2>
            <p className='text-muted-foreground mb-4'>
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new Privacy Policy on
              this page and updating the &quot;Last updated&quot; date. You are
              advised to review this Privacy Policy periodically for any
              changes.
            </p>
          </section>

          <section className='mb-8'>
            <h2 className='mb-4 text-2xl font-semibold'>11. Contact Us</h2>
            <p className='text-muted-foreground mb-4'>
              If you have any questions about this Privacy Policy, please
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

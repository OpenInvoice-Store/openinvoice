# Open Invoice

A modern, full-featured invoice management system built with Next.js, TypeScript, and Shadcn UI. Manage your invoices, customers, products, and payments all in one beautiful dashboard.

<p align="center">
  <img src="/public/openstore.png" alt="Open Invoice Dashboard" style="max-width: 100%; border-radius: 8px;" />
</p>

## Overview

Open Invoice is a comprehensive invoice management solution designed for businesses of all sizes. Create, manage, and track invoices effortlessly with an intuitive interface backed by powerful features like customer management, product catalogs, payment tracking, and detailed analytics.

Built with modern web technologies and best practices, Open Invoice provides a production-ready foundation for managing your invoicing workflow.

### Key Features

- 📝 **Invoice Management** - Create, edit, and manage invoices with a beautiful, user-friendly interface
- 🔄 **Recurring Invoices & Subscriptions** - Create recurring invoice templates with automated generation, subscription management, and flexible scheduling
- 👥 **Customer Management** - Keep track of all your customers with detailed contact information
- 📦 **Product Catalog** - Manage your products and services with pricing and tax information
- 💰 **Payment Tracking** - Record and track payments against invoices
- 📧 **Email Management** - Send invoices via email with tracking and engagement metrics
- 📊 **Analytics Dashboard** - Visual insights into your invoicing with charts and statistics
- 🎯 **Kanban Board** - Visual invoice workflow management with drag-and-drop
- 🔗 **Shareable Invoices** - Generate secure, shareable links for your clients
- 📄 **PDF Generation** - Export invoices as professional PDF documents
- 🎨 **Branding & Templates** - Customize company branding (logo, colors, fonts) and create multiple invoice templates
- 🏢 **Multi-Tenant Workspaces** - Organize invoices by workspace/team with Clerk Organizations
- 🔐 **Secure Authentication** - Enterprise-grade authentication with Clerk
- 💳 **Subscription Management** - Built-in billing and subscription handling
- 🔒 **Role-Based Access Control** - Fine-grained permissions and access control
- 💳 **Stripe Payment Processing** - Accept online payments with Stripe Connect, support for partial payments, and automatic invoice status updates
- 🧾 **Custom Tax System** - Flexible tax calculation with tax profiles, rules, and jurisdictions. Support for multiple tax types (sales tax, VAT/GST, service tax) with presets for common regions

## Tech Stack

This application is built with the following technologies:

- **Framework** - [Next.js 16](https://nextjs.org/16) with App Router
- **Language** - [TypeScript](https://www.typescriptlang.org)
- **Authentication** - [Clerk](https://clerk.com)
- **Database** - PostgreSQL with [Prisma](https://www.prisma.io)
- **Email Service** - [Resend](https://resend.com) for transactional emails
- **Payment Processing** - [Stripe](https://stripe.com) with Connect for multi-tenant payments
- **Error Tracking** - [Sentry](https://sentry.io/for/nextjs/)
- **Styling** - [Tailwind CSS v4](https://tailwindcss.com)
- **UI Components** - [Shadcn UI](https://ui.shadcn.com)
- **Forms** - [React Hook Form](https://react-hook-form.com) with [Zod](https://zod.dev) validation
- **Data Tables** - [TanStack Table](https://tanstack.com/table)
- **Charts** - [Recharts](https://recharts.org)
- **State Management** - [Zustand](https://zustand-demo.pmnd.rs)
- **Command Interface** - [kbar](https://kbar.vercel.app/)
- **PDF Generation** - [@react-pdf/renderer](https://react-pdf.org)

## Project Structure

The project follows a feature-based architecture for better organization and scalability:

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication routes
│   ├── dashboard/           # Dashboard pages
│   │   ├── invoices/        # Invoice management
│   │   ├── customers/       # Customer management
│   │   ├── products/        # Product management
│   │   ├── overview/        # Analytics dashboard
│   │   └── kanban/          # Kanban board
│   ├── invoice/             # Public invoice view (shareable)
│   └── api/                 # API routes
│
├── features/                # Feature-based modules
│   ├── invoicing/          # Invoice-related components & hooks
│   ├── kanban/             # Kanban board components
│   └── overview/           # Dashboard analytics components
│
├── components/              # Shared components
│   ├── ui/                 # Shadcn UI components
│   └── layout/             # Layout components (sidebar, header)
│
├── lib/                     # Core utilities
│   ├── db.ts               # Prisma client
│   ├── format.ts           # Formatting utilities
│   └── utils.ts            # General utilities
│
└── prisma/                  # Database schema and migrations
    └── schema.prisma        # Prisma schema
```

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database
- Clerk account (for authentication)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/usaikoo/openinvoice.git
   cd open-invoice
   ```

2. **Install dependencies**

   ```bash
   bun install
   # or
   npm install
   ```

3. **Set up environment variables**

   Copy the example environment file:
   ```bash
   cp env.example.txt .env.local
   ```

   Update `.env.local` with your configuration:
   - Database connection string (`DATABASE_URL`)
   - Clerk authentication keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
   - Resend API key (`RESEND_API_KEY`) for email functionality
   - Resend webhook key (`RESEND_WEBHOOK_KEY`) for email event tracking
   - Stripe keys (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) for payment processing
   - Stripe webhook secret (`STRIPE_WEBHOOK_SECRET`) for webhook verification
   - AWS S3 credentials (for file uploads, if applicable)
   - Sentry DSN (for error tracking, optional)

4. **Set up the database**

   ```bash
   # Generate Prisma Client
   bun prisma generate
   
   # Run migrations
   bun prisma migrate dev
   ```

5. **Run the development server**

   ```bash
   bun run dev
   ```

   The application will be available at [http://localhost:3000](http://localhost:3000)

### Environment Configuration

For detailed setup instructions, see:

- **Clerk Setup** (Authentication, Organizations, Billing & Webhooks) - [docs/clerk_setup.md](./docs/clerk_setup.md)
- **Stripe Connect Setup** - [docs/stripe_connect_setup.md](./docs/stripe_connect_setup.md)
- **Payment Reminders Cron Job** - [docs/cron_setup.md](./docs/cron_setup.md)
- **RBAC Configuration** - [docs/nav-rbac.md](./docs/nav-rbac.md)

## Features Overview

### Invoice Management

- Create and edit invoices with multiple line items
- Track invoice status (Draft, Sent, Paid, Overdue, Cancelled)
- Automatic invoice numbering
- Calculate subtotals, taxes, and totals automatically
- Add custom notes to invoices
- Generate PDF documents
- Share invoices via secure, shareable links
- Modern invoice details page with left-side section navigation (Details, Payments, Emails, Notes)

### Recurring Invoices & Subscriptions

- Create recurring invoice templates with flexible scheduling (daily, weekly, monthly, quarterly, yearly, custom)
- Automated invoice generation via cron job
- Subscription management with pause/resume/cancel functionality
- Template-based invoice creation with reusable items
- Automatic email sending for generated invoices
- Next generation date tracking
- View all invoices generated from a template
- Statistics dashboard showing revenue, payments, and invoice counts
- Manual invoice generation on demand
- End date support for time-limited subscriptions
- Custom interval support for flexible billing cycles

### Customer Management

- Store customer contact information
- Track all invoices per customer
- Quick access to customer history

### Product Management

- Maintain a catalog of products/services
- Set prices and tax rates
- Add product images
- Quick product selection when creating invoices

### Branding & Templates

- **Company Branding** - Customize your company's appearance on invoices
  - Upload and manage company logo
  - Set primary and secondary brand colors
  - Choose font family for invoices
  - Add company contact information (address, phone, email, website)
  - Customize footer text
  - Set default currency per organization

- **Invoice Templates** - Create and manage multiple invoice templates
  - Create custom invoice templates with unique layouts
  - Set default template for automatic assignment
  - Activate/deactivate templates
  - Configure template layouts (standard, compact, detailed)
  - Custom header and footer templates (HTML)
  - Custom CSS styling (JSON)
  - Template selection when creating new invoices
  - Template management interface with CRUD operations

### Analytics Dashboard

- Overview of key metrics
- Revenue charts and trends
- Invoice status distribution
- Sales performance analytics
- Parallel routes for independent loading states

### Kanban Board

- Visual invoice workflow management
- Drag and drop between status columns
- Quick invoice updates
- Local state persistence

### Multi-Tenant Support

- Create and switch between workspaces
- Team management and collaboration
- Role-based access control
- Organization-level billing and subscriptions

### Email Management

- Send invoices directly to customers via email
- Professional HTML email templates with invoice details
- Automatic payment confirmation emails
- Complete email tracking and audit trail
- Real-time email engagement metrics (opens, clicks, delivery status)
- Email history with detailed event logs
- Resend webhook integration for event tracking
- Email status badges and notifications
- Left-side section navigation for email history (integrated with invoice details page)
- Track email opens, clicks, bounces, and delivery events

### Payment Processing

- **Stripe Connect Integration** - Multi-tenant payment processing with Express accounts
- **Online Payments** - Accept credit card payments directly on invoices
- **Payment Forms** - Secure, PCI-compliant payment forms using Stripe Elements
- **Multiple Payment Methods** - Support for cards, ACH, bank transfers via Stripe's automatic payment methods
- **Saved Payment Methods** - Stripe Customer integration with saved cards for faster checkout
- **Partial Payments** - Support for partial invoice payments with balance tracking
- **Payment Plans & Installments** - Split invoices into multiple installments (weekly, biweekly, monthly, quarterly) with automatic payment allocation and status tracking
- **Automatic Status Updates** - Invoice status automatically updates on successful payment
- **Payment Validation** - Amount validation prevents overpayment
- **Webhook Processing** - Real-time payment status updates via Stripe webhooks
- **Payment History** - Complete payment tracking with Stripe payment intent IDs
- **Payment Receipts** - Generate PDF receipts for each payment with download action
- **Email Confirmations** - Automatic payment confirmation emails to customers
- **Stripe Onboarding** - Streamlined Stripe Connect account setup in settings
- **Stripe Account Management** - Soft disconnect, reconnect, and reset options for better UX
- **Platform Fees** - Configurable platform fee calculation and application

### Tax Management

- **Custom Tax System** - Built-in tax calculation engine without third-party dependencies
  - **Tax Profiles** - Create tax profiles for different jurisdictions (country + region)
  - **Multiple Tax Rules** - Define multiple tax rules per profile (e.g., GST + PST, VAT + local tax)
  - **Tax Presets** - Pre-configured tax templates for common regions:
    - Canada: GST (5%), PST (varies by province), QST/TVQ (9.975%)
    - United States: State tax templates
    - European Union: VAT templates
    - United Kingdom: VAT templates
    - Australia: GST templates
    - India: GST templates
  - **Tax Calculation** - Automatic tax calculation based on selected tax profile
  - **Tax Breakdown** - Detailed tax breakdown displayed on invoices, PDFs, and emails with percentages
  - **Manual Tax Override** - Override default tax rates for specific invoices
  - **Tax Exemptions** - Support for tax-exempt customers with exemption reasons
  - **Default Tax Profile** - Set default tax profile per organization
  - **Tax Authority Labels** - Categorize taxes by authority type (federal, state, provincial, VAT, local)
  - **User-Controlled** - Simple, explicit tax system where business owners choose appropriate taxes

## Roadmap

### Phase 1: Payment Processing (Q1 2026) ✅ Completed

- [x] **Stripe Integration**
  - [x] Set up Stripe account and API keys ✅
  - [x] Stripe Connect Express accounts integration ✅
  - [x] Create payment intent API endpoints ✅
  - [x] Build payment form component with Stripe Elements ✅
  - [x] Implement webhook handling for payment status updates ✅
  - [x] Add "Pay Now" button to invoice view pages (public and dashboard) ✅
  - [x] Update invoice status automatically on successful payment ✅
  - [x] Support for partial payments ✅
  - [x] Payment amount validation and balance checking ✅
  - [x] Email notifications for payment confirmations ✅
  - [x] Stripe Connect onboarding flow in settings ✅
  - [x] Platform fee calculation and application ✅
  - [x] Payment error handling and user feedback ✅
  - [x] Payment method storage (Stripe Customer + saved cards via setup_future_usage) ✅
  - [x] Payment receipt generation ✅

### Phase 1.5: Email Functionality (Q1 2026) ✅ Completed

- [x] **Email Service Integration**
  - [x] Resend email service integration
  - [x] Send invoice emails to customers with PDF and shareable links
  - [x] Payment confirmation email automation
  - [x] Professional HTML email templates for invoices and payments
  - [x] Email tracking and logging system with database models
  - [x] Email history UI with scrollable drawer interface
  - [x] Resend webhook integration for real-time event tracking
  - [x] Track email opens, clicks, bounces, and delivery events
  - [x] Email audit trail with timestamps and metadata
  - [x] Email engagement metrics (open counts, click counts, delivery status)
  - [x] Right sidebar navigation for email/payment/notes history
  - [x] Email status badges and detailed event logs

### Phase 2: Enhanced Payment Features (Q2 2026) ✅ Completed

- [x] **Payment Methods Expansion** ✅
  - [x] Support for multiple payment methods (cards, ACH, bank transfers via automatic_payment_methods) ✅
  - [x] Saved payment methods for recurring customers (via Stripe Customer + setup_future_usage) ✅
  - [x] Payment plans and installments ✅
    - [x] Payment plan creation with configurable frequency (weekly, biweekly, monthly, quarterly) ✅
    - [x] Automatic installment generation with proper rounding handling ✅
    - [x] Installment status tracking (pending, paid, overdue, cancelled) ✅
    - [x] Automatic payment allocation to installments in order ✅
    - [x] Payment plan UI components and management interface ✅
    - [x] Installment-specific payment amounts on shared invoices ✅
    - [x] Payment plan display with installment list and status badges ✅
    - [x] Support for 2-60 installments per payment plan ✅
  - [x] Automatic payment retry for failed transactions ✅
    - [x] Automatic retry cron job with exponential backoff (1h, 6h, 24h) ✅
    - [x] Retry tracking (count, last retry, next retry, status) ✅
    - [x] Retry using saved payment methods ✅
    - [x] Retry status display in payment UI ✅
    - [x] Configurable max retries (default: 3) ✅
    - [x] GitHub Actions workflow integration ✅
  - [x] Payment method preferences by customer ✅
    - [x] Store Stripe customer ID on Customer model ✅
    - [x] Store preferred payment method ID ✅
    - [x] API endpoint to get/set payment method preferences ✅
    - [x] Payment intent uses preferred payment method automatically ✅
    - [x] UI to manage payment method preferences in customer edit page ✅
    - [x] Display saved payment methods with card details ✅
    - [x] Set/remove default payment method ✅

### Phase 3: Multi-Provider Support (Q3 2026) - Optional

- [ ] **Hyperswitch Integration** (if multi-provider support needed)
  - [ ] Evaluate Hyperswitch deployment options (self-hosted vs cloud)
  - [ ] Integrate Hyperswitch API for payment processing
  - [ ] Configure multiple payment providers (Stripe, PayPal, Adyen, etc.)
  - [ ] Implement intelligent routing based on success rates
  - [ ] Add payment provider switching for failed transactions
  - [ ] Cost optimization and observability dashboards
  - [ ] Advanced retry strategies and revenue recovery

### Phase 4: Advanced Features (Q4 2026)

- [x] **Recurring Invoices & Subscriptions** ✅
  - [x] Recurring invoice templates ✅
  - [x] Automated invoice generation ✅
  - [x] Subscription management ✅
  - [x] Usage-based billing ✅
    - [x] Enable usage-based billing on templates ✅
    - [x] Record usage data with period tracking ✅
    - [x] Automatic invoice calculation from usage ✅
    - [x] Usage history and management UI ✅
    - [x] Link usage records to generated invoices ✅
  - [x] Recurring invoice detail page with left sidebar navigation ✅
    - [x] Overview section with statistics and template details ✅
    - [x] Items section with add/edit functionality ✅
    - [x] Usage section for usage-based templates ✅
    - [x] Invoices section with generated invoices list and manual generation ✅
    - [x] Notes section with add/edit functionality ✅
- [x] **Automation & Notifications** ✅
  - [x] Payment reminders and automated follow-ups ✅
    - [x] Automated cron job for payment reminders (GitHub Actions) ✅
    - [x] Reminder emails for upcoming invoices (3 days before due) ✅
    - [x] Reminder emails for due today invoices ✅
    - [x] Overdue invoice notifications (7, 14, 30+ days) ✅
    - [x] Manual "Send Reminder" button in invoice view ✅
    - [x] Reminders sidebar section with reminder history ✅
    - [x] Reminder tracking (count, last sent date) ✅
    - [x] Flexible testing mode with query parameters ✅
    - [x] Debug mode for troubleshooting ✅
  - [x] Overdue invoice notifications ✅
  - [x] Custom email templates ✅
  - [ ] SMS notifications (optional)
- [ ] **International & Compliance**
  - [x] Multi-currency support ✅
    - [x] Currency field on invoices with organization default fallback ✅
    - [x] Currency selection in invoice forms ✅
    - [x] Currency display in invoice views and PDFs ✅
    - [x] Currency support for recurring invoices and templates ✅
    - [x] Currency display in recurring invoice tables and detail pages ✅
    - [x] Support for 20+ currencies (USD, EUR, GBP, JPY, CAD, etc.) ✅
  - [x] **Custom Tax System** ✅
    - [x] Tax profile management with country and region support ✅
    - [x] Multiple tax rules per profile (GST, PST, VAT, etc.) ✅
    - [x] Tax presets for common regions (Canada, US, EU, UK, Australia, India) ✅
    - [x] Tax calculation engine with percentage-based rates ✅
    - [x] Tax breakdown display in invoices, PDFs, and emails ✅
    - [x] Manual tax override support ✅
    - [x] Tax exemption support for customers ✅
    - [x] Default tax profile per organization ✅
  - [ ] Payment dispute management
  - [ ] Compliance reporting (GDPR, PCI-DSS)
- [x] **Branding & Templates** ✅
  - [x] Custom branding (logo, colors, fonts) ✅
    - [x] Logo upload and management with image preview ✅
    - [x] Primary and secondary color customization (hex colors) ✅
    - [x] Font family selection for invoices ✅
    - [x] Company information settings (address, phone, email, website) ✅
    - [x] Footer text customization ✅
    - [x] Default currency setting per organization ✅
  - [x] Invoice template customization ✅
    - [x] Multiple invoice templates per organization ✅
    - [x] Template creation, editing, and deletion ✅
    - [x] Default template selection and management ✅
    - [x] Template activation/deactivation ✅
    - [x] Template layout configuration (standard, compact, detailed) ✅
    - [x] Custom header and footer templates (HTML) ✅
    - [x] Custom CSS styles (JSON) ✅
    - [x] Template selection when creating invoices ✅
    - [x] Automatic default template assignment ✅
  - [ ] Branded email templates (using branding settings)
  - [x] Custom invoice layouts ✅
  - [x] Company branding settings page ✅
- [x] **Advanced Analytics** ✅
  - [x] Custom report builder ✅
  - [x] Export capabilities (CSV, Excel, PDF) ✅
  - [x] Financial forecasting ✅
  - [x] Customer lifetime value analysis ✅

### Phase 5: Crypto Payment Integration (Final Phase)

- [ ] **Crypto Payment Integration**
  - [ ] Research and select crypto payment provider (Coinbase Commerce, BitPay, etc.)
  - [ ] Set up crypto payment API integration
  - [ ] Implement crypto payment form component
  - [ ] Add crypto payment option to invoice payment page
  - [ ] Support for multiple cryptocurrencies (Bitcoin, Ethereum, USDC, etc.)
  - [ ] Real-time exchange rate conversion
  - [ ] Crypto payment webhook handling for status updates
  - [ ] Automatic invoice status updates on crypto payment confirmation
  - [ ] Crypto payment history and tracking
  - [ ] Payment confirmation emails for crypto transactions
  - [ ] Crypto wallet address generation and management
  - [ ] Transaction verification and blockchain confirmation tracking

## Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Fix linting issues
- `bun run format` - Format code with Prettier

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:

- **Customer** - Customer information and contact details
- **Product** - Product/service catalog with pricing
- **Invoice** - Invoice headers with status and dates
- **InvoiceItem** - Line items for each invoice
- **Payment** - Payment records linked to invoices and installments
- **PaymentPlan** - Payment plan configuration (frequency, installment count)
- **Installment** - Individual payment installments with due dates and amounts
- **RecurringInvoiceTemplate** - Recurring invoice templates with scheduling and automation
- **TaxProfile** - Tax profiles for different jurisdictions (country, region)
- **TaxRule** - Individual tax rules within a tax profile (name, rate, authority)
- **InvoiceTax** - Tax breakdown records for each invoice
- **EmailLog** - Email tracking and audit trail
- **EmailEvent** - Individual email events (opens, clicks, bounces, etc.)

See `prisma/schema.prisma` for the complete schema definition.

## Support

If you find Open Invoice useful and would like to support its development, you can:

- [☕ Buy me a coffee](https://buymeacoffee.com/saikodev) - Quick one-time support
- [💝 Sponsor on GitHub](https://github.com/sponsors/usaikoo) - Recurring monthly support

Your support helps maintain and improve this project! 🙏

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

See [LICENSE](./LICENSE) for details.

---

Built with ❤️ using Next.js and Shadcn UI

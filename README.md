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
- 👥 **Customer Management** - Keep track of all your customers with detailed contact information
- 📦 **Product Catalog** - Manage your products and services with pricing and tax information
- 💰 **Payment Tracking** - Record and track payments against invoices
- 📧 **Email Management** - Send invoices via email with tracking and engagement metrics
- 📊 **Analytics Dashboard** - Visual insights into your invoicing with charts and statistics
- 🎯 **Kanban Board** - Visual invoice workflow management with drag-and-drop
- 🔗 **Shareable Invoices** - Generate secure, shareable links for your clients
- 📄 **PDF Generation** - Export invoices as professional PDF documents
- 🏢 **Multi-Tenant Workspaces** - Organize invoices by workspace/team with Clerk Organizations
- 🔐 **Secure Authentication** - Enterprise-grade authentication with Clerk
- 💳 **Subscription Management** - Built-in billing and subscription handling
- 🔒 **Role-Based Access Control** - Fine-grained permissions and access control
- 💳 **Stripe Payment Processing** - Accept online payments with Stripe Connect, support for partial payments, and automatic invoice status updates

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

### Customer Management

- Store customer contact information
- Track all invoices per customer
- Quick access to customer history

### Product Management

- Maintain a catalog of products/services
- Set prices and tax rates
- Add product images
- Quick product selection when creating invoices

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
- Right sidebar drawer navigation for email history
- Track email opens, clicks, bounces, and delivery events

### Payment Processing

- **Stripe Connect Integration** - Multi-tenant payment processing with Express accounts
- **Online Payments** - Accept credit card payments directly on invoices
- **Payment Forms** - Secure, PCI-compliant payment forms using Stripe Elements
- **Partial Payments** - Support for partial invoice payments with balance tracking
- **Automatic Status Updates** - Invoice status automatically updates on successful payment
- **Payment Validation** - Amount validation prevents overpayment
- **Webhook Processing** - Real-time payment status updates via Stripe webhooks
- **Payment History** - Complete payment tracking with Stripe payment intent IDs
- **Email Confirmations** - Automatic payment confirmation emails to customers
- **Stripe Onboarding** - Streamlined Stripe Connect account setup in settings
- **Platform Fees** - Configurable platform fee calculation and application

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
  - [ ] Payment method storage (optional: Stripe Customer portal)
  - [ ] Payment receipt generation

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

### Phase 2: Enhanced Payment Features (Q2 2026)

- [ ] **Payment Methods Expansion**
  - [ ] Support for multiple payment methods (cards, ACH, bank transfers)
  - [ ] Saved payment methods for recurring customers
  - [ ] Payment plans and installments
  - [ ] Automatic payment retry for failed transactions
  - [ ] Payment method preferences by customer
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
- [ ] **Payment Analytics**
  - [ ] Payment success rate tracking
  - [ ] Failed payment analysis and insights
  - [ ] Payment method performance metrics
  - [ ] Revenue forecasting based on payment patterns

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

- [ ] **Recurring Invoices & Subscriptions**
  - [ ] Recurring invoice templates
  - [ ] Automated invoice generation
  - [ ] Subscription management
  - [ ] Usage-based billing
- [ ] **Automation & Notifications**
  - [ ] Payment reminders and automated follow-ups
  - [ ] Overdue invoice notifications
  - [x] Custom email templates ✅
  - [ ] SMS notifications (optional)
- [ ] **International & Compliance**
  - [ ] Multi-currency support
  - [ ] Tax calculation integration (Avalara, TaxJar)
  - [ ] Payment dispute management
  - [ ] Compliance reporting (GDPR, PCI-DSS)
- [ ] **Advanced Analytics**
  - [ ] Custom report builder
  - [ ] Export capabilities (CSV, Excel, PDF)
  - [ ] Financial forecasting
  - [ ] Customer lifetime value analysis

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
- **Payment** - Payment records linked to invoices
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

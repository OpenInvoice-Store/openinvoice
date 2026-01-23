# Clerk Setup Guide

This guide covers the setup and configuration of all Clerk features used in this starter template, including authentication, organizations, billing, and webhooks.

## Clerk Scopes Required

- **Authentication** - User sign-in/sign-up and session management
- **Organizations** - Multi-tenant workspace management (see setup below)
- **Billing** - Organization-level subscription management (see setup below)

## Clerk Organizations Setup (Workspaces & Teams)

This starter kit includes multi-tenant workspace management powered by **Clerk Organizations**. To enable this feature:

### Enable Organizations in Clerk Dashboard:

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **configure**
3. Click **Organizations settings**
4. Configure default roles if needed in the roles and permissions.

### Server-Side Permission Checks:

- This starter follows [Clerk's recommended patterns](https://clerk.com/blog/how-to-build-multitenant-authentication-with-clerk)

### Navigation RBAC System:

- Fully client-side navigation filtering using `useNav` hook
- Supports `requireOrg`, `permission`, and `role` checks (all client-side, instant)
- Configured in `src/config/nav-config.ts` with `access` properties
- See `docs/nav-rbac.md` for detailed documentation

### For more information, see:

- [Clerk Organizations documentation](https://clerk.com/docs/organizations/overview)
- [Multi-tenant authentication guide](https://clerk.com/blog/how-to-build-multitenant-authentication-with-clerk)

## Clerk Billing Setup (Organization Subscriptions)

This starter kit includes **Clerk Billing for B2B** to manage organization-level subscriptions. Plans and features are managed through the Clerk Dashboard, and the application checks access using Clerk's `has()` function.

> [!WARNING]
> Billing is currently in Beta and its APIs are experimental and may undergo breaking changes. To mitigate potential disruptions, we recommend pinning your SDK and `clerk-js` package versions.

### Key Features:

- Organization-level subscription management
- Plan-based access control using `<Protect>` component
- Feature-based authorization
- Integrated Stripe payment processing
- Server-side plan/feature checks using `has()` function

### Billing Cost Structure:

Clerk Billing costs **0.7% per transaction**, plus transaction fees which are paid directly to Stripe. Clerk Billing is **not** the same as Stripe Billing. Plans and pricing are managed directly through the Clerk Dashboard and won't sync with your existing Stripe products or plans. Clerk uses Stripe **only** for payment processing, so you don't need to set up Stripe Billing.

### Setup Instructions:

#### 1. Enable Billing:

- Navigate to [Billing Settings](https://dashboard.clerk.com/~/billing/settings) in the Clerk Dashboard
- Enable billing for your application
- Choose payment gateway:
  - **Clerk development gateway**: A shared **test** Stripe account for development instances. This allows developers to test and build Billing flows **in development** without needing to create and configure a Stripe account.
  - **Stripe account**: Use your own Stripe account for production. **A Stripe account created for a development instance cannot be used for production**. You will need to create a separate Stripe account for your production environment.

#### 2. Create Plans:

- Navigate to [Plans page](https://dashboard.clerk.com/~/billing/plans) in the Clerk Dashboard
- Select **Plans for Organizations** tab
- Click **Add Plan** and create plans (e.g., `free`, `pro`, `team`)
- Set pricing and billing intervals
- Toggle **Publicly available** to show in `<PricingTable />` and `<OrganizationProfile />` components

#### 3. Add Features to Plans:

- You can add Features when creating a Plan, or add them later:
  1. Navigate to the [Plans](https://dashboard.clerk.com/~/billing/plans) page
  2. Select the Plan you'd like to add a Feature to
  3. In the **Features** section, select **Add Feature**
- Feature names in Clerk Dashboard should match what you check in code

#### 4. Usage in Code:

**Server-side checks using `has()`:**

```typescript
// Check if organization has a Plan
const hasPremiumAccess = has({ plan: 'gold' });

// Check if organization has a Feature
const hasPremiumAccess = has({ feature: 'widgets' });
```

The `has()` method is available on the auth object and checks if the Organization has been granted a specific type of access control (Role, Permission, Feature, or Plan) and returns a boolean value.

**Client-side protection using `<Protect>`:**

```tsx
<Protect
  plan='bronze'
  fallback={<p>Only subscribers to the Bronze plan can access this content.</p>}
>
  <h1>Exclusive Bronze Content</h1>
</Protect>
```

Or protect by Feature:

```tsx
<Protect
  feature='premium_access'
  fallback={
    <p>
      Only subscribers with the Premium Access feature can access this content.
    </p>
  }
>
  <h1>Exclusive Premium Content</h1>
</Protect>
```

## Clerk Webhook Setup

This guide explains how to set up Clerk webhooks to sync user and organization data to your database.

### Overview

The webhook handler at `/api/webhooks/clerk` automatically syncs:
- **Users**: When users sign up, update their profile, or delete their account
- **Organizations/Teams**: When organizations are created, updated, or deleted
- **Memberships**: When users join or leave organizations, and when their roles change

### Prerequisites

1. **Install dependencies**:
   ```bash
   npm install svix
   ```

2. **Run database migration**:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

3. **Set environment variable**:
   Make sure `WEBHOOK_SECRET` is set in your `.env` file (already configured in `env.txt`)

### Setting Up Webhooks in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Configure** → **Webhooks**
3. Click **Add Endpoint**
4. Enter your webhook URL:
   - **Development**: `http://localhost:3000/api/webhooks/clerk` (use ngrok or similar for local testing)
   - **Production**: `https://yourdomain.com/api/webhooks/clerk`
5. Select the following events to subscribe to:
   - `user.created`
   - `user.updated`
   - `user.deleted`
   - `organization.created`
   - `organization.updated`
   - `organization.deleted`
   - `organizationMembership.created`
   - `organizationMembership.updated`
   - `organizationMembership.deleted`
6. Copy the **Signing Secret** (starts with `whsec_`)
7. Add it to your `.env` file as `WEBHOOK_SECRET`

### Database Schema

The webhook handler creates and maintains the following tables:

#### Users Table
- `id`: Primary key (Clerk user ID)
- `clerkUserId`: Unique Clerk user ID
- `email`: User's email address
- `firstName`: User's first name
- `lastName`: User's last name
- `imageUrl`: User's profile image URL
- `createdAt`, `updatedAt`: Timestamps

#### Organizations Table
- `id`: Primary key (Clerk organization ID)
- `clerkOrgId`: Unique Clerk organization ID
- `name`: Organization name
- `slug`: Organization slug (unique)
- `imageUrl`: Organization image URL
- `createdAt`, `updatedAt`: Timestamps

#### Organization Members Table
- `id`: Primary key
- `userId`: Foreign key to users table
- `organizationId`: Foreign key to organizations table
- `role`: User's role in the organization (e.g., "admin", "member")
- `createdAt`, `updatedAt`: Timestamps
- Unique constraint on `(userId, organizationId)`

### How It Works

1. **User Events**:
   - `user.created`: Creates a new user record in the database
   - `user.updated`: Updates existing user record
   - `user.deleted`: Removes user record (cascades to memberships)

2. **Organization Events**:
   - `organization.created`: Creates a new organization record
   - `organization.updated`: Updates organization details
   - `organization.deleted`: Removes organization (cascades to memberships)

3. **Membership Events**:
   - `organizationMembership.created`: Links a user to an organization
   - `organizationMembership.updated`: Updates user's role in organization
   - `organizationMembership.deleted`: Removes user from organization

### Testing Webhooks Locally

For local development, you'll need to expose your local server:

1. **Using ngrok** (recommended):
   ```bash
   ngrok http 3000
   ```
   Use the ngrok URL in your Clerk webhook endpoint

2. **Using Clerk CLI** (alternative):
   ```bash
   npx @clerk/cli webhooks serve
   ```

### Security

The webhook handler verifies all incoming requests using Svix signatures:
- Verifies `svix-id`, `svix-timestamp`, and `svix-signature` headers
- Rejects any requests that fail verification
- Uses the `WEBHOOK_SECRET` from your environment variables

### Troubleshooting

- **Webhook not receiving events**: Check that the webhook URL is accessible and the endpoint is correctly configured
- **Database errors**: Ensure migrations have been run and Prisma client is regenerated
- **Verification failures**: Verify that `WEBHOOK_SECRET` matches the signing secret from Clerk Dashboard

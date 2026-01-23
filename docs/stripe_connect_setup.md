# Stripe Connect Setup Guide

This guide covers the setup and configuration of Stripe Connect for multi-tenant payment processing in Open Invoice.

## Overview

Open Invoice uses **Stripe Connect** to enable each organization to connect their own Stripe account. This allows:
- Each organization to receive payments directly to their Stripe account
- Organizations to manage their own payment settings
- Platform to optionally charge application fees
- Secure, PCI-compliant payment processing

## Prerequisites

1. **Stripe Account**: You need a Stripe account to act as the platform account
2. **Stripe Connect Enabled**: Enable Stripe Connect in your Stripe Dashboard
3. **Environment Variables**: Configure Stripe API keys

## Setup Steps

### 1. Create Stripe Platform Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create or log into your Stripe account
3. Navigate to **Settings > Connect**
4. Enable **Stripe Connect** for your account
5. Choose **Express accounts** (recommended for easier onboarding)

### 2. Get API Keys

1. Go to [API Keys](https://dashboard.stripe.com/apikeys) in Stripe Dashboard
2. Copy your **Publishable key** and **Secret key**
3. Add them to your `.env.local` file:

```env
# Platform Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Set Up Webhook Endpoint

1. Go to [Webhooks](https://dashboard.stripe.com/webhooks) in Stripe Dashboard
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated`
5. Copy the **Signing secret** and add to `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 4. Configure Redirect URLs

Update your `.env.local` with your application URL:

```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

This is used for OAuth redirects after Stripe account connection.

### 5. Run Database Migration

After updating the Prisma schema, run:

```bash
bun prisma migrate dev --name add_stripe_connect
# or
npm run prisma migrate dev --name add_stripe_connect
```

### 6. Install Dependencies

Install the required Stripe packages:

```bash
bun add stripe @stripe/stripe-js @stripe/react-stripe-js
# or
npm install stripe @stripe/stripe-js @stripe/react-stripe-js
```

## How It Works

### Organization Connection Flow

1. Organization admin goes to **Dashboard > Billing**
2. Clicks **Connect Stripe Account**
3. Redirected to Stripe OAuth flow
4. Completes Stripe onboarding (business details, bank account, etc.)
5. Returns to application with connected account
6. Can now accept payments

### Payment Flow

1. Customer views invoice (dashboard or public link)
2. Clicks **Pay Now** button (only shown if Stripe is connected)
3. Enters payment details using Stripe Elements
4. Payment is processed on the organization's connected Stripe account
5. Webhook updates invoice status automatically
6. Payment confirmation email is sent

### Platform Fees (Optional)

To charge platform fees, set in `.env.local`:

```env
STRIPE_PLATFORM_FEE_PERCENTAGE=2.9
```

This will charge 2.9% of each payment as a platform fee.

## API Endpoints

### Stripe Connect

- `GET /api/stripe/connect/authorize` - Initiate OAuth connection
- `GET /api/stripe/connect/status` - Check connection status
- `POST /api/stripe/connect/disconnect` - Disconnect Stripe account

### Payment Processing

- `POST /api/stripe/payment-intent` - Create payment intent for invoice
- `POST /api/webhooks/stripe` - Handle Stripe webhooks

## Testing

### Test Mode

1. Use Stripe test mode keys (keys starting with `sk_test_` and `pk_test_`)
2. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0027 6000 3184`

### Testing Webhooks Locally

Use Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will give you a webhook signing secret for local testing.

## Security Considerations

1. **Never expose secret keys** - Only use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on the frontend
2. **Verify webhook signatures** - Always verify webhook requests using the signing secret
3. **HTTPS required** - Stripe Connect requires HTTPS in production
4. **PCI Compliance** - Using Stripe Elements ensures PCI compliance

## Troubleshooting

### Organization can't connect Stripe

- Check that `STRIPE_SECRET_KEY` is set correctly
- Verify Stripe Connect is enabled in your Stripe Dashboard
- Check browser console for errors

### Payments not processing

- Verify organization has completed Stripe onboarding
- Check that `charges_enabled` is true for the connected account
- Review Stripe Dashboard for payment failures

### Webhooks not working

- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check webhook endpoint URL in Stripe Dashboard
- Use Stripe CLI to test webhooks locally
- Check server logs for webhook processing errors

## Additional Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Elements Documentation](https://stripe.com/docs/stripe-js)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)


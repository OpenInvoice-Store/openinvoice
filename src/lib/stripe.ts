import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

// Initialize Stripe with platform account secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true
});

// Get publishable key for frontend
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
};

// Calculate platform fee (optional)
export const calculatePlatformFee = (amount: number): number => {
  const feePercentage = parseFloat(
    process.env.STRIPE_PLATFORM_FEE_PERCENTAGE || '0'
  );
  if (feePercentage <= 0) return 0;
  return Math.round(amount * (feePercentage / 100));
};

/**
 * Payment utility functions
 * Shared logic for payment filtering and processing
 */

export interface Payment {
  id: string;
  method: string | null;
  amount: number;
  notes?: string | null;
  [key: string]: any;
}

/**
 * Filter out pending crypto payments (amount = 0)
 * These are payment requests that haven't received transactions yet.
 * They will appear once a transaction is detected and amount is updated.
 *
 * @param payments - Array of payment objects
 * @returns Filtered array excluding pending crypto payments
 */
export function filterVisiblePayments<T extends Payment>(payments: T[]): T[] {
  return payments.filter(
    (payment) =>
      !(payment.method?.startsWith('crypto_') && payment.amount === 0)
  );
}

/**
 * Check if a payment is a pending crypto payment request
 * (crypto payment with amount = 0, meaning no transaction detected yet)
 *
 * @param payment - Payment object to check
 * @returns True if payment is a pending crypto payment request
 */
export function isPendingCryptoPayment(payment: Payment): boolean {
  return !!(payment.method?.startsWith('crypto_') && payment.amount === 0);
}

/**
 * Check if a payment is a crypto payment
 *
 * @param payment - Payment object to check
 * @returns True if payment method starts with 'crypto_'
 */
export function isCryptoPayment(payment: Payment): boolean {
  return !!payment.method?.startsWith('crypto_');
}

/**
 * Check if a crypto payment is confirmed
 * Confirmed crypto payments have "Crypto payment confirmed" in notes and a transaction hash
 *
 * @param payment - Payment object to check
 * @returns True if crypto payment is confirmed
 */
export function isCryptoPaymentConfirmed(payment: Payment): boolean {
  if (!isCryptoPayment(payment)) {
    return false;
  }

  // Check if notes contain confirmation message and transaction hash (64 hex characters)
  return !!(
    payment.notes?.includes('Crypto payment confirmed') &&
    payment.notes?.match(/[A-F0-9]{64}/i)
  );
}

/**
 * Check if a crypto payment is underpaid
 * Underpaid payments have "UNDERPAID" in notes
 *
 * @param payment - Payment object to check
 * @returns True if crypto payment is underpaid
 */
export function isCryptoPaymentUnderpaid(payment: Payment): boolean {
  if (!isCryptoPayment(payment)) {
    return false;
  }

  return !!payment.notes?.includes('UNDERPAID');
}

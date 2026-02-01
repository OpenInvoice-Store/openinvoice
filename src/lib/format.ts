import { formatCurrencyAmount } from './currency';

export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch (_err) {
    return '';
  }
}

/**
 * Format currency amount
 * @deprecated Use formatCurrencyAmount from '@/lib/currency' for better multi-currency support
 * This function is kept for backward compatibility
 */
export function formatCurrency(amount: number, currency: string = 'USD') {
  return formatCurrencyAmount(amount, currency);
}

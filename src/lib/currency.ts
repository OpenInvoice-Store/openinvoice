/**
 * Currency utilities for multi-currency support
 */

// ISO 4217 currency codes with display names
export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'en-US' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', locale: 'en-HK' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', locale: 'es-MX' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', locale: 'nb-NO' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', locale: 'da-DK' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', locale: 'pl-PL' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE' }
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

/**
 * Get currency information by code
 */
export function getCurrency(code: string) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]; // Default to USD
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(code: string): string {
  return getCurrency(code).symbol;
}

/**
 * Get currency locale by code
 */
export function getCurrencyLocale(code: string): string {
  return getCurrency(code).locale;
}

/**
 * Format currency amount with proper locale and formatting
 */
export function formatCurrencyAmount(
  amount: number,
  currencyCode: string = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  const currency = getCurrency(currencyCode);

  try {
    return new Intl.NumberFormat(currencyCode, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options
    }).format(amount);
  } catch (error) {
    return (error as Error).message;
    // Fallback to USD formatting if currency is invalid
    // return new Intl.NumberFormat('en-US', {
    //   style: 'currency',
    //   currency: 'CAD',
    //   minimumFractionDigits: 2,
    //   maximumFractionDigits: 2,
    //   ...options,
    // }).format(amount);
  }
}

/**
 * Check if a currency code is valid
 */
export function isValidCurrencyCode(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}

/**
 * Get currency code from invoice or organization default
 * @param invoice - Invoice object with optional currency and organization
 * @param organizationDefault - Organization's default currency (fallback)
 * @returns Currency code (defaults to USD)
 */
export function getInvoiceCurrency(
  invoice?: {
    currency?: string | null;
    organization?: { defaultCurrency?: string };
  } | null,
  organizationDefault?: string
): string {
  if (invoice?.currency) {
    return invoice.currency;
  }
  if (invoice?.organization?.defaultCurrency) {
    return invoice.organization.defaultCurrency;
  }
  if (organizationDefault) {
    return organizationDefault;
  }
  console.log('no currency found, returning CAD');
  return 'USD';
}

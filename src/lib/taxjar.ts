/**
 * TaxJar Integration Service
 *
 * Handles tax calculations using TaxJar API.
 * TaxJar provides accurate, real-time tax rates for US sales tax and international taxes.
 */

import Taxjar from 'taxjar';
import { normalizeCountryCode } from '@/constants/countries';

export interface TaxJarAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface TaxJarLineItem {
  id: string;
  quantity: number;
  product_identifier?: string;
  description?: string;
  product_tax_code?: string;
  unit_price: number;
  discount?: number;
  sales_tax?: number;
}

export interface TaxJarTaxCalculationParams {
  from_country: string;
  from_zip?: string;
  from_state?: string;
  from_city?: string;
  from_street?: string;
  to_country: string;
  to_zip?: string;
  to_state?: string;
  to_city?: string;
  to_street?: string;
  amount: number;
  shipping: number;
  line_items?: TaxJarLineItem[];
  nexus_addresses?: Array<{
    country: string;
    state?: string;
    zip?: string;
    city?: string;
    street?: string;
  }>;
  customer_id?: string;
  exemption_type?: string;
}

export interface TaxJarTaxResult {
  order_total_amount: number;
  shipping: number;
  taxable_amount: number;
  amount_to_collect: number;
  rate: number;
  has_nexus: boolean;
  freight_taxable: boolean;
  tax_source: string;
  jurisdictions: {
    country: string;
    state: string;
    county?: string;
    city?: string;
  };
  breakdown: {
    taxable_amount: number;
    tax_collectable: number;
    combined_tax_rate: number;
    state_taxable_amount: number;
    state_tax_rate: number;
    state_tax_collectable: number;
    county_taxable_amount?: number;
    county_tax_rate?: number;
    county_tax_collectable?: number;
    city_taxable_amount?: number;
    city_tax_rate?: number;
    city_tax_collectable?: number;
    special_district_taxable_amount?: number;
    special_district_tax_rate?: number;
    special_district_tax_collectable?: number;
    line_items?: Array<{
      id: string;
      taxable_amount: number;
      tax_collectable: number;
      combined_tax_rate: number;
      state_taxable_amount: number;
      state_tax_rate: number;
      state_tax_collectable: number;
    }>;
  };
}

/**
 * Get TaxJar client instance
 * Supports both Sandbox and Production environments
 */
export function getTaxJarClient(apiKey?: string, useSandbox?: boolean): Taxjar {
  const key = apiKey || process.env.TAXJAR_API_KEY;

  if (!key) {
    throw new Error(
      'TaxJar API key is required. Set TAXJAR_API_KEY environment variable or provide apiKey parameter.'
    );
  }

  // Check if we should use sandbox
  // Can be explicitly set, or detected from env var, or if key contains 'sandbox'
  const isSandbox =
    useSandbox !== undefined
      ? useSandbox
      : process.env.TAXJAR_USE_SANDBOX === 'true' ||
        key.toLowerCase().includes('sandbox') ||
        process.env.NODE_ENV === 'development';

  const config: any = {
    apiKey: key
  };

  // Configure sandbox URL if needed
  if (isSandbox) {
    config.apiUrl = 'https://api.sandbox.taxjar.com';
  }

  return new Taxjar(config);
}

/**
 * Parse address string into structured address components
 * This is a simple parser - you may want to use a more robust address parsing library
 */
export function parseAddress(addressString?: string | null): TaxJarAddress {
  if (!addressString) {
    return {};
  }

  // Simple parsing - assumes format like "123 Main St, City, State ZIP" or "123 Main St, City, State ZIP, Country"
  const parts = addressString.split(',').map((p) => p.trim());

  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    const stateZip = parts[2].split(' ');
    const state = stateZip[0];
    const zip = stateZip.slice(1).join(' ');
    const country = parts[3] || 'US';

    return {
      street,
      city,
      state,
      zip,
      country
    };
  }

  // Fallback: try to extract ZIP code (US format: 5 digits or 5+4)
  const zipMatch = addressString.match(/\b\d{5}(-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[0] : undefined;

  return {
    street: addressString,
    zip,
    country: 'US' // Default to US if can't parse
  };
}

/**
 * Calculate tax using TaxJar
 */
export async function calculateTaxJarTax(params: {
  apiKey?: string;
  useSandbox?: boolean;
  fromAddress: TaxJarAddress;
  toAddress: TaxJarAddress;
  amount: number;
  shipping?: number;
  lineItems?: Array<{
    id: string;
    quantity: number;
    price: number;
    description?: string;
    productTaxCode?: string;
  }>;
  nexusRegions?: Array<{
    country: string;
    state?: string;
    zip?: string;
    city?: string;
    street?: string;
  }>;
  customerId?: string;
  exemptionType?: string;
}): Promise<TaxJarTaxResult> {
  const client = getTaxJarClient(params.apiKey, params.useSandbox);

  // Normalize country codes using shared utility
  const fromCountry = normalizeCountryCode(params.fromAddress.country);
  const toCountry = normalizeCountryCode(params.toAddress.country);

  const taxParams: TaxJarTaxCalculationParams = {
    from_country: fromCountry,
    from_zip: params.fromAddress.zip,
    from_state: params.fromAddress.state,
    from_city: params.fromAddress.city,
    from_street: params.fromAddress.street,
    to_country: toCountry,
    to_zip: params.toAddress.zip,
    to_state: params.toAddress.state,
    to_city: params.toAddress.city,
    to_street: params.toAddress.street,
    amount: params.amount,
    shipping: params.shipping || 0,
    ...(params.nexusRegions &&
      params.nexusRegions.length > 0 && {
        nexus_addresses: params.nexusRegions
      }),
    ...(params.customerId && { customer_id: params.customerId }),
    ...(params.exemptionType && { exemption_type: params.exemptionType })
  };

  // Add line items if provided
  if (params.lineItems && params.lineItems.length > 0) {
    taxParams.line_items = params.lineItems.map((item, index) => ({
      id: item.id || `line-item-${index}`,
      quantity: item.quantity,
      unit_price: item.price,
      description: item.description,
      ...(item.productTaxCode && { product_tax_code: item.productTaxCode })
    }));
  }

  try {
    const result = await client.taxForOrder(taxParams);
    // TaxJar SDK returns TaxForOrderRes, which may be wrapped in a 'tax' property
    // or may be the tax object directly
    const taxResult = (result as any).tax || result;

    return taxResult as unknown as TaxJarTaxResult;
  } catch (error: any) {
    console.error('TaxJar API error:', error);

    // Provide more specific error messages
    if (error.status === 401 || error.error === 'Unauthorized') {
      throw new Error(
        "TaxJar API key is invalid or unauthorized. Please check your API key in Settings → Payments → TaxJar Integration. Make sure you're using the correct key (Sandbox or Production)."
      );
    }

    if (error.status === 400) {
      throw new Error(
        `TaxJar request invalid: ${error.detail || error.message || 'Please check customer address information.'}`
      );
    }

    throw new Error(
      `TaxJar calculation failed: ${error.message || error.detail || 'Unknown error'}`
    );
  }
}

/**
 * Convert TaxJar tax result to our TaxCalculationResult format
 */
export function convertTaxJarResultToTaxCalculation(
  taxJarResult: TaxJarTaxResult,
  subtotal: number
): {
  totalTax: number;
  taxes: Array<{
    name: string;
    rate: number;
    amount: number;
    authority?: string;
  }>;
  subtotal: number;
  total: number;
} {
  const taxes: Array<{
    name: string;
    rate: number;
    amount: number;
    authority?: string;
  }> = [];

  const breakdown = taxJarResult.breakdown;

  // Only process breakdown if it exists
  if (breakdown) {
    // Add state tax
    if (
      breakdown.state_tax_collectable &&
      breakdown.state_tax_collectable > 0
    ) {
      taxes.push({
        name: `${taxJarResult.jurisdictions?.state || 'State'} State Tax`,
        rate: (breakdown.state_tax_rate || 0) * 100, // Convert to percentage
        amount: breakdown.state_tax_collectable,
        authority: 'state'
      });
    }

    // Add county tax
    if (
      breakdown.county_tax_collectable &&
      breakdown.county_tax_collectable > 0
    ) {
      taxes.push({
        name: `${breakdown.county_taxable_amount ? 'County' : ''} Tax`,
        rate: (breakdown.county_tax_rate || 0) * 100,
        amount: breakdown.county_tax_collectable,
        authority: 'county'
      });
    }

    // Add city tax
    if (breakdown.city_tax_collectable && breakdown.city_tax_collectable > 0) {
      taxes.push({
        name: `${taxJarResult.jurisdictions.city || 'City'} Tax`,
        rate: (breakdown.city_tax_rate || 0) * 100,
        amount: breakdown.city_tax_collectable,
        authority: 'city'
      });
    }

    // Add special district tax
    if (
      breakdown.special_district_tax_collectable &&
      breakdown.special_district_tax_collectable > 0
    ) {
      taxes.push({
        name: 'Special District Tax',
        rate: (breakdown.special_district_tax_rate || 0) * 100,
        amount: breakdown.special_district_tax_collectable,
        authority: 'special_district'
      });
    }
  }

  // If no breakdown taxes but we have a total tax amount, create a single tax entry
  const amountToCollect =
    typeof taxJarResult.amount_to_collect === 'number'
      ? taxJarResult.amount_to_collect
      : parseFloat(taxJarResult.amount_to_collect as any) || 0;

  if (taxes.length === 0 && amountToCollect > 0) {
    taxes.push({
      name: 'Sales Tax',
      rate: (taxJarResult.rate || 0) * 100,
      amount: amountToCollect,
      authority: 'combined'
    });
  }

  const totalTax = amountToCollect;
  const total = subtotal + totalTax;

  return {
    totalTax,
    taxes,
    subtotal,
    total
  };
}

/**
 * Create a TaxJar transaction (for record keeping and reporting)
 */
export async function createTaxJarTransaction(params: {
  apiKey?: string;
  transactionId: string;
  transactionDate: string; // YYYY-MM-DD format
  fromAddress: TaxJarAddress;
  toAddress: TaxJarAddress;
  amount: number;
  shipping: number;
  salesTax: number;
  lineItems?: TaxJarLineItem[];
  customerId?: string;
  exemptionType?: string;
}): Promise<any> {
  const client = getTaxJarClient(params.apiKey);

  const transactionParams: any = {
    transaction_id: params.transactionId,
    transaction_date: params.transactionDate,
    from_country: params.fromAddress.country || 'US',
    from_zip: params.fromAddress.zip,
    from_state: params.fromAddress.state,
    from_city: params.fromAddress.city,
    from_street: params.fromAddress.street,
    to_country: params.toAddress.country || 'US',
    to_zip: params.toAddress.zip,
    to_state: params.toAddress.state,
    to_city: params.toAddress.city,
    to_street: params.toAddress.street,
    amount: params.amount,
    shipping: params.shipping,
    sales_tax: params.salesTax,
    ...(params.lineItems &&
      params.lineItems.length > 0 && {
        line_items: params.lineItems
      }),
    ...(params.customerId && { customer_id: params.customerId }),
    ...(params.exemptionType && { exemption_type: params.exemptionType })
  };

  try {
    const result = await client.createOrder(transactionParams);
    return result;
  } catch (error: any) {
    console.error('TaxJar transaction creation error:', error);
    throw new Error(
      `TaxJar transaction creation failed: ${error.message || 'Unknown error'}`
    );
  }
}

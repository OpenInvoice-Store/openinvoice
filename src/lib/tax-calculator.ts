/**
 * Tax Calculation Engine
 *
 * Handles tax calculation for invoices using tax profiles and rules.
 * Supports multiple taxes, tax exemptions, and invoice-level overrides.
 * Also supports TaxJar for automatic tax calculations.
 */

import { prisma } from './db';
import {
  calculateTaxJarTax,
  convertTaxJarResultToTaxCalculation,
  parseAddress,
  TaxJarAddress
} from './taxjar';
import { normalizeCountryCode } from '@/constants/countries';

export interface TaxCalculationResult {
  totalTax: number;
  taxes: Array<{
    name: string;
    rate: number;
    amount: number;
    authority?: string;
  }>;
  subtotal: number;
  total: number;
  stripeTaxEnabled?: boolean; // Flag to indicate Stripe Tax should be used
}

export interface InvoiceTaxInput {
  invoiceId?: string;
  items: Array<{
    price: number;
    quantity: number;
    description?: string;
    productTaxCode?: string;
  }>;
  customerId: string;
  organizationId: string;
  taxProfileId?: string | null;
  taxOverrides?: Array<{
    name: string;
    rate: number;
    authority?: string;
  }>;
  useTaxJar?: boolean; // Force TaxJar usage if true
  useStripeTax?: boolean; // Force Stripe Tax usage if true
  shipping?: number; // Shipping amount for TaxJar/Stripe Tax calculations
}

/**
 * Calculate tax for an invoice
 * Supports multiple tax calculation methods:
 * 1. Stripe Tax (if enabled and useStripeTax is true)
 * 2. TaxJar (if enabled and useTaxJar is true)
 * 3. Tax overrides (if provided)
 * 4. Tax profiles (custom tax rules)
 * 5. Manual (no tax)
 */
export async function calculateTax(
  input: InvoiceTaxInput
): Promise<TaxCalculationResult> {
  const {
    items,
    customerId,
    organizationId,
    taxProfileId,
    taxOverrides,
    useTaxJar,
    useStripeTax,
    shipping = 0
  } = input;

  // Calculate subtotal
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Get customer and organization data
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });

  // Check if customer is tax-exempt
  if (customer?.taxExempt) {
    return {
      totalTax: 0,
      taxes: [],
      subtotal,
      total: subtotal
    };
  }

  // Get organization with tax settings
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      defaultTaxProfile: {
        include: {
          taxRules: {
            where: { isActive: true }
          }
        }
      }
    }
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  // IMPORTANT: Stripe Tax is NOT used for invoice-time tax calculation
  // Stripe Tax only calculates tax at payment time via PaymentIntent with automatic_tax
  // For invoice creation, we ONLY use TaxJar or Tax Profiles

  // Check TaxJar settings
  const taxJarEnabled = (organization as any).taxJarEnabled || false;
  const taxJarApiKey =
    (organization as any).taxJarApiKey || process.env.TAXJAR_API_KEY;

  // Try TaxJar if enabled and requested (for invoice-time calculation)
  const taxJarNexusRegions = (organization as any).taxJarNexusRegions
    ? JSON.parse((organization as any).taxJarNexusRegions)
    : undefined;

  // Detect if using sandbox
  const useSandbox =
    process.env.TAXJAR_USE_SANDBOX === 'true' ||
    (taxJarApiKey && taxJarApiKey.toLowerCase().includes('sandbox'));

  // Use TaxJar for invoice-time tax calculation (Stripe Tax is NOT used here - it's payment-time only)
  if (
    (useTaxJar || taxJarEnabled) &&
    taxJarApiKey &&
    !taxProfileId &&
    !taxOverrides
  ) {
    try {
      // Parse addresses
      const fromAddress: TaxJarAddress = parseAddress(
        (organization as any).companyAddress
      );
      // Use structured address fields if available, otherwise parse address string
      const toAddress: TaxJarAddress = {
        street: (customer as any)?.addressLine1 || undefined,
        city: (customer as any)?.city || undefined,
        state: (customer as any)?.state || undefined,
        zip: (customer as any)?.postalCode || undefined,
        country: (customer as any)?.country || undefined,
        ...(customer?.address && !(customer as any)?.addressLine1
          ? parseAddress(customer.address)
          : {})
      };

      // Ensure we have minimum required address info for TaxJar
      // For US: need country + (state OR zip)
      // For international: need country + (state/province OR city)
      const hasMinAddressInfo =
        toAddress.country &&
        (toAddress.zip ||
          toAddress.state ||
          (toAddress.country !== 'US' && toAddress.city));

      if (hasMinAddressInfo) {
        const taxJarResult = await calculateTaxJarTax({
          apiKey: taxJarApiKey,
          useSandbox: useSandbox,
          fromAddress: {
            ...fromAddress,
            country: normalizeCountryCode(fromAddress.country)
          },
          toAddress: {
            ...toAddress,
            country: normalizeCountryCode(toAddress.country)
          },
          amount: subtotal,
          shipping,
          lineItems: items.map((item, index) => ({
            id: `item-${index}`,
            quantity: item.quantity,
            price: item.price,
            description: item.description,
            productTaxCode: item.productTaxCode
          })),
          nexusRegions: taxJarNexusRegions,
          customerId: customerId,
          exemptionType: customer?.taxExempt ? 'non_exempt' : undefined
        });

        const result = convertTaxJarResultToTaxCalculation(
          taxJarResult,
          subtotal
        );
        return result;
      } else {
        console.warn(
          'TaxJar: Insufficient address information. Customer needs: country + (state/ZIP for US, or state/city for international). Falling back to tax profiles.'
        );
        // Don't throw error, just fall through to tax profile calculation
      }
    } catch (error: any) {
      // If it's an auth error, we should surface it
      if (
        error.message?.includes('API key') ||
        error.message?.includes('Unauthorized')
      ) {
        throw error; // Re-throw auth errors so user knows to fix API key
      }
      console.error(
        'TaxJar calculation failed, falling back to tax profiles:',
        error
      );
      // Fall through to tax profile calculation for other errors
    }
  }

  // If tax overrides are provided, use them
  if (taxOverrides && taxOverrides.length > 0) {
    const taxes = taxOverrides.map((tax) => ({
      name: tax.name,
      rate: tax.rate,
      amount: (subtotal * tax.rate) / 100,
      authority: tax.authority
    }));

    const totalTax = taxes.reduce((sum, tax) => sum + tax.amount, 0);

    return {
      totalTax,
      taxes,
      subtotal,
      total: subtotal + totalTax
    };
  }

  // Get tax profile
  let taxProfile = null;

  if (taxProfileId) {
    taxProfile = await prisma.taxProfile.findUnique({
      where: { id: taxProfileId },
      include: {
        taxRules: {
          where: { isActive: true }
        }
      }
    });
  } else {
    taxProfile = organization.defaultTaxProfile || null;
  }

  // If no tax profile, return no tax
  if (!taxProfile || taxProfile.taxRules.length === 0) {
    return {
      totalTax: 0,
      taxes: [],
      subtotal,
      total: subtotal
    };
  }

  // Calculate tax using tax rules
  const taxes = taxProfile.taxRules.map((rule) => ({
    name: rule.name,
    rate: rule.rate,
    amount: (subtotal * rule.rate) / 100,
    authority: rule.authority || undefined
  }));

  const totalTax = taxes.reduce((sum, tax) => sum + tax.amount, 0);

  return {
    totalTax,
    taxes,
    subtotal,
    total: subtotal + totalTax
  };
}

/**
 * Get applicable tax profile for an organization
 */
export async function getTaxProfile(
  organizationId: string,
  countryCode?: string,
  regionCode?: string
): Promise<{ id: string; name: string; taxRules: any[] } | null> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      taxProfiles: {
        include: {
          taxRules: {
            where: { isActive: true }
          }
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
      },
      defaultTaxProfile: {
        include: {
          taxRules: {
            where: { isActive: true }
          }
        }
      }
    }
  });

  if (!organization) {
    return null;
  }

  // If country/region specified, try to find matching profile
  if (countryCode) {
    const matchingProfile = organization.taxProfiles.find((profile) => {
      const countryMatch = profile.countryCode === countryCode;
      const regionMatch = regionCode
        ? profile.regionCode === regionCode
        : !profile.regionCode;
      return countryMatch && regionMatch;
    });

    if (matchingProfile) {
      return {
        id: matchingProfile.id,
        name: matchingProfile.name,
        taxRules: matchingProfile.taxRules
      };
    }
  }

  // Return default profile or first profile
  if (organization.defaultTaxProfile) {
    return {
      id: organization.defaultTaxProfile.id,
      name: organization.defaultTaxProfile.name,
      taxRules: organization.defaultTaxProfile.taxRules
    };
  }

  if (organization.taxProfiles.length > 0) {
    const firstProfile = organization.taxProfiles[0];
    return {
      id: firstProfile.id,
      name: firstProfile.name,
      taxRules: firstProfile.taxRules
    };
  }

  return null;
}

/**
 * Apply tax exemptions to invoice
 */
export async function applyTaxExemptions(
  invoiceId: string,
  taxRules: any[]
): Promise<any[]> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true
    }
  });

  if (!invoice || !invoice.customer?.taxExempt) {
    return taxRules;
  }

  // If customer is tax-exempt, return empty rules
  return [];
}

/**
 * Format tax breakdown for display
 */
export function formatTaxBreakdown(
  taxes: Array<{
    name: string;
    rate: number;
    amount: number;
    authority?: string;
  }>
): string {
  return JSON.stringify(taxes, null, 2);
}

/**
 * Save invoice taxes to database
 * @param tx - Optional Prisma transaction client. If provided, uses transaction; otherwise uses regular prisma client.
 */
export async function saveInvoiceTaxes(
  invoiceId: string,
  taxes: Array<{
    name: string;
    rate: number;
    amount: number;
    authority?: string;
    isOverride?: boolean;
  }>,
  tx?: any
): Promise<void> {
  const client = tx || prisma;

  // Delete existing invoice taxes
  await client.invoiceTax.deleteMany({
    where: { invoiceId }
  });

  // Create new invoice taxes
  if (taxes.length > 0) {
    await client.invoiceTax.createMany({
      data: taxes.map((tax) => ({
        invoiceId,
        name: tax.name,
        rate: tax.rate,
        amount: tax.amount,
        authority: tax.authority || null,
        isOverride: tax.isOverride || false
      }))
    });
  }
}

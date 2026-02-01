/**
 * Tax Calculation Engine
 *
 * Handles tax calculation for invoices using tax profiles and rules.
 * Supports multiple taxes, tax exemptions, and invoice-level overrides.
 */

import { prisma } from './db';

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
}

export interface InvoiceTaxInput {
  invoiceId?: string;
  items: Array<{
    price: number;
    quantity: number;
  }>;
  customerId: string;
  organizationId: string;
  taxProfileId?: string | null;
  taxOverrides?: Array<{
    name: string;
    rate: number;
    authority?: string;
  }>;
}

/**
 * Calculate tax for an invoice
 */
export async function calculateTax(
  input: InvoiceTaxInput
): Promise<TaxCalculationResult> {
  const { items, customerId, organizationId, taxProfileId, taxOverrides } =
    input;

  // Calculate subtotal
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Check if customer is tax-exempt
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });

  if (customer?.taxExempt) {
    return {
      totalTax: 0,
      taxes: [],
      subtotal,
      total: subtotal
    };
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
    // Get default tax profile for organization
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

    taxProfile = organization?.defaultTaxProfile || null;
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

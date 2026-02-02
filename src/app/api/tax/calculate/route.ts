import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { calculateTax } from '@/lib/tax-calculator';

/**
 * POST /api/tax/calculate
 * Calculate tax using tax system (TaxJar, tax profiles, or overrides)
 *
 * Request body:
 * {
 *   items: [{ price, quantity, description?, productTaxCode? }],
 *   customerId: string,
 *   organizationId?: string,
 *   taxProfileId?: string,
 *   taxOverrides?: [{ name, rate, authority? }],
 *   useTaxJar?: boolean, // Force TaxJar usage
 *   shipping?: number // Shipping amount for TaxJar
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      items,
      customerId,
      organizationId: providedOrgId,
      taxProfileId,
      taxOverrides,
      useTaxJar,
      useStripeTax,
      shipping
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const targetOrgId = providedOrgId || orgId;

    // Calculate tax using tax calculator (supports TaxJar, profiles, overrides)
    const result = await calculateTax({
      items: items.map((item: any) => ({
        price: parseFloat(item.price || item.amount || 0),
        quantity: parseInt(item.quantity || 1),
        description: item.description,
        productTaxCode: item.productTaxCode
      })),
      customerId,
      organizationId: targetOrgId,
      taxProfileId: taxProfileId || null,
      taxOverrides: taxOverrides || undefined,
      useTaxJar: useTaxJar || false,
      useStripeTax: useStripeTax || false,
      shipping: shipping || 0
    });

    return NextResponse.json({
      success: true,
      taxAmount: result.totalTax,
      taxes: result.taxes,
      subtotal: result.subtotal,
      total: result.total,
      taxBreakdown: JSON.stringify(result.taxes)
    });
  } catch (error: any) {
    console.error('Error calculating tax:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate tax' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  TAX_PRESETS,
  getTaxPresetsByCountry,
  getAvailableCountries
} from '@/lib/tax-presets';

/**
 * GET /api/tax/presets
 * Get tax preset templates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get('countryCode');

    if (countryCode) {
      const presets = getTaxPresetsByCountry(countryCode);
      return NextResponse.json(presets);
    }

    // Return all presets and available countries
    return NextResponse.json({
      presets: TAX_PRESETS,
      countries: getAvailableCountries()
    });
  } catch (error) {
    console.error('Error fetching tax presets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax presets' },
      { status: 500 }
    );
  }
}

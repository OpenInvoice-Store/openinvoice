/**
 * Tax Preset Templates
 *
 * These are default tax configurations for common jurisdictions.
 * All presets include a disclaimer that rates may change and should be verified locally.
 */

export interface TaxPreset {
  id: string;
  name: string;
  countryCode: string;
  regionCode?: string;
  description: string;
  disclaimer: string;
  taxRules: Array<{
    name: string;
    rate: number;
    authority: string;
  }>;
}

export const TAX_PRESETS: TaxPreset[] = [
  // Canada - Federal GST
  {
    id: 'ca-gst',
    name: 'Canada - GST',
    countryCode: 'CA',
    description: 'Federal Goods and Services Tax (5%)',
    disclaimer: 'GST rate is 5%. Verify current rates with CRA.',
    taxRules: [
      {
        name: 'GST',
        rate: 5.0,
        authority: 'federal'
      }
    ]
  },
  // Canada - Quebec (GST + QST)
  {
    id: 'ca-qc',
    name: 'Canada - Quebec',
    countryCode: 'CA',
    regionCode: 'QC',
    description: 'GST (5%) + QST/TVQ (9.975%)',
    disclaimer:
      'GST is 5%, QST/TVQ is 9.975%. Verify current rates with Revenu Québec.',
    taxRules: [
      {
        name: 'GST',
        rate: 5.0,
        authority: 'federal'
      },
      {
        name: 'QST',
        rate: 9.975,
        authority: 'provincial'
      }
    ]
  },
  // Canada - Ontario (GST + HST)
  {
    id: 'ca-on',
    name: 'Canada - Ontario',
    countryCode: 'CA',
    regionCode: 'ON',
    description: 'HST (13%)',
    disclaimer: 'HST rate is 13%. Verify current rates with CRA.',
    taxRules: [
      {
        name: 'HST',
        rate: 13.0,
        authority: 'federal'
      }
    ]
  },
  // Canada - British Columbia (GST + PST)
  {
    id: 'ca-bc',
    name: 'Canada - British Columbia',
    countryCode: 'CA',
    regionCode: 'BC',
    description: 'GST (5%) + PST (7%)',
    disclaimer:
      'GST is 5%, PST is 7%. Verify current rates with CRA and BC Ministry of Finance.',
    taxRules: [
      {
        name: 'GST',
        rate: 5.0,
        authority: 'federal'
      },
      {
        name: 'PST',
        rate: 7.0,
        authority: 'provincial'
      }
    ]
  },
  // United States - Generic State Tax
  {
    id: 'us-generic',
    name: 'United States - State Tax',
    countryCode: 'US',
    description: 'State sales tax (rate varies by state)',
    disclaimer:
      'State tax rates vary. Set the correct rate for your state. Verify with your state tax authority.',
    taxRules: [
      {
        name: 'State Tax',
        rate: 0.0, // User must set rate
        authority: 'state'
      }
    ]
  },
  // United States - California
  {
    id: 'us-ca',
    name: 'United States - California',
    countryCode: 'US',
    regionCode: 'CA',
    description: 'California sales tax (base rate ~7.25%, varies by locality)',
    disclaimer:
      'California sales tax varies by locality. Base rate is approximately 7.25%. Verify with California Department of Tax and Fee Administration.',
    taxRules: [
      {
        name: 'State & Local Tax',
        rate: 7.25,
        authority: 'state'
      }
    ]
  },
  // United States - New York
  {
    id: 'us-ny',
    name: 'United States - New York',
    countryCode: 'US',
    regionCode: 'NY',
    description: 'New York sales tax (base rate ~8%, varies by locality)',
    disclaimer:
      'New York sales tax varies by locality. Base rate is approximately 8%. Verify with New York State Department of Taxation and Finance.',
    taxRules: [
      {
        name: 'State & Local Tax',
        rate: 8.0,
        authority: 'state'
      }
    ]
  },
  // United States - Texas
  {
    id: 'us-tx',
    name: 'United States - Texas',
    countryCode: 'US',
    regionCode: 'TX',
    description: 'Texas sales tax (base rate 6.25%, varies by locality)',
    disclaimer:
      'Texas sales tax varies by locality. Base rate is 6.25%. Verify with Texas Comptroller of Public Accounts.',
    taxRules: [
      {
        name: 'State & Local Tax',
        rate: 6.25,
        authority: 'state'
      }
    ]
  },
  // European Union - VAT (Generic)
  {
    id: 'eu-vat',
    name: 'European Union - VAT',
    countryCode: 'EU',
    description: 'Value Added Tax (rate varies by country)',
    disclaimer:
      'VAT rates vary by EU member country. Set the correct rate for your country. Verify with your local tax authority.',
    taxRules: [
      {
        name: 'VAT',
        rate: 0.0, // User must set rate
        authority: 'vat'
      }
    ]
  },
  // United Kingdom - VAT
  {
    id: 'gb-vat',
    name: 'United Kingdom - VAT',
    countryCode: 'GB',
    description: 'UK VAT (standard rate 20%)',
    disclaimer:
      'UK VAT standard rate is 20%. Reduced rates may apply. Verify with HM Revenue & Customs.',
    taxRules: [
      {
        name: 'VAT',
        rate: 20.0,
        authority: 'vat'
      }
    ]
  },
  // France - VAT
  {
    id: 'fr-vat',
    name: 'France - VAT',
    countryCode: 'FR',
    description: 'French VAT/TVA (standard rate 20%)',
    disclaimer:
      'French VAT standard rate is 20%. Reduced rates may apply. Verify with Direction Générale des Finances Publiques.',
    taxRules: [
      {
        name: 'TVA',
        rate: 20.0,
        authority: 'vat'
      }
    ]
  },
  // Germany - VAT
  {
    id: 'de-vat',
    name: 'Germany - VAT',
    countryCode: 'DE',
    description: 'German VAT/MwSt (standard rate 19%)',
    disclaimer:
      'German VAT standard rate is 19%. Reduced rates may apply. Verify with Bundeszentralamt für Steuern.',
    taxRules: [
      {
        name: 'MwSt',
        rate: 19.0,
        authority: 'vat'
      }
    ]
  },
  // Australia - GST
  {
    id: 'au-gst',
    name: 'Australia - GST',
    countryCode: 'AU',
    description: 'Australian Goods and Services Tax (10%)',
    disclaimer:
      'Australian GST rate is 10%. Verify with Australian Taxation Office.',
    taxRules: [
      {
        name: 'GST',
        rate: 10.0,
        authority: 'federal'
      }
    ]
  },
  // India - GST
  {
    id: 'in-gst',
    name: 'India - GST',
    countryCode: 'IN',
    description:
      'Indian Goods and Services Tax (rates vary: 5%, 12%, 18%, 28%)',
    disclaimer:
      'Indian GST rates vary by product/service category (5%, 12%, 18%, 28%). Verify with GST Council.',
    taxRules: [
      {
        name: 'GST',
        rate: 18.0, // Most common rate
        authority: 'federal'
      }
    ]
  }
];

/**
 * Get tax preset by ID
 */
export function getTaxPreset(presetId: string): TaxPreset | undefined {
  return TAX_PRESETS.find((preset) => preset.id === presetId);
}

/**
 * Get tax presets by country code
 */
export function getTaxPresetsByCountry(countryCode: string): TaxPreset[] {
  return TAX_PRESETS.filter((preset) => preset.countryCode === countryCode);
}

/**
 * Get all available country codes
 */
export function getAvailableCountries(): string[] {
  return Array.from(new Set(TAX_PRESETS.map((preset) => preset.countryCode)));
}

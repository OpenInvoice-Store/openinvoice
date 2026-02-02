/**
 * Country constants for TaxJar and other integrations
 * ISO 2-letter country codes with display names
 */

export interface Country {
  code: string; // ISO 2-letter code (e.g., "US", "CA")
  name: string; // Display name (e.g., "United States", "Canada")
}

/**
 * Common countries supported by TaxJar and Stripe
 * ISO 2-letter codes with display names
 */
export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'FI', name: 'Finland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'JP', name: 'Japan' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' }
];

/**
 * Get country name by code
 */
export function getCountryName(code: string): string {
  const country = COUNTRIES.find((c) => c.code === code.toUpperCase());
  return country?.name || code;
}

/**
 * Check if a country code is valid
 */
export function isValidCountryCode(code: string): boolean {
  return COUNTRIES.some((c) => c.code === code.toUpperCase());
}

/**
 * Normalize country code to 2-letter ISO format (uppercase)
 * Converts 3-letter codes to 2-letter, validates format
 */
export function normalizeCountryCode(country?: string): string {
  if (!country) return 'US'; // Default to US

  // Convert to uppercase and trim
  const normalized = country.toUpperCase().trim();

  // If it's already 2 letters, validate and return
  if (normalized.length === 2 && /^[A-Z]{2}$/.test(normalized)) {
    return isValidCountryCode(normalized) ? normalized : 'US';
  }

  // If it's 3 letters (like "USA"), try to convert common ones
  if (normalized.length === 3) {
    const threeToTwo: Record<string, string> = {
      USA: 'US',
      CAN: 'CA',
      GBR: 'GB',
      AUS: 'AU',
      FRA: 'FR',
      DEU: 'DE',
      ITA: 'IT',
      ESP: 'ES',
      NLD: 'NL',
      BEL: 'BE',
      AUT: 'AT',
      FIN: 'FI',
      SWE: 'SE',
      NOR: 'NO',
      DNK: 'DK',
      POL: 'PL',
      PRT: 'PT',
      CHE: 'CH',
      SGP: 'SG',
      HKG: 'HK',
      JPN: 'JP',
      MEX: 'MX',
      BRA: 'BR'
    };
    if (threeToTwo[normalized]) {
      return threeToTwo[normalized];
    }
  }

  // If invalid format, log warning and default to US
  console.warn(
    `Invalid country code format "${country}", defaulting to US. Expected 2-letter ISO code (e.g., US, CA, GB).`
  );
  return 'US';
}

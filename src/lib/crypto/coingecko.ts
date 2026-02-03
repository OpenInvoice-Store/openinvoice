/**
 * CoinGecko API Integration for Cryptocurrency Exchange Rates
 * Documentation: https://www.coingecko.com/en/api/documentation
 * Free tier: 10-50 calls/minute (no API key needed)
 */

const COINGECKO_API_URL =
  process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

// CoinGecko coin IDs mapping
export const COIN_IDS: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  usdt: 'tether',
  usdc: 'usd-coin',
  busd: 'binance-usd',
  bnb: 'binancecoin',
  sol: 'solana',
  xrp: 'ripple',
  doge: 'dogecoin',
  ltc: 'litecoin',
  bch: 'bitcoin-cash',
  trx: 'tron',
  algo: 'algorand',
  xmr: 'monero'
};

// Fiat currency codes supported by CoinGecko
export const SUPPORTED_FIAT = [
  'usd',
  'eur',
  'gbp',
  'jpy',
  'cad',
  'aud',
  'chf',
  'cny',
  'inr',
  'brl',
  'mxn',
  'krw',
  'sek',
  'nok',
  'dkk',
  'pln',
  'rub',
  'zar',
  'sgd',
  'hkd',
  'nzd'
];

interface CoinGeckoPriceResponse {
  [coinId: string]: {
    [fiatCurrency: string]: number;
  };
}

interface CoinGeckoError {
  error: string;
}

/**
 * Get CoinGecko API headers
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  if (COINGECKO_API_KEY) {
    headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
  }

  return headers;
}

/**
 * Get current price of cryptocurrency in fiat currency
 */
export async function getCryptoPrice(
  cryptocurrency: string,
  fiatCurrency: string = 'usd'
): Promise<number> {
  const coinId = COIN_IDS[cryptocurrency.toLowerCase()];
  if (!coinId) {
    throw new Error(`Unsupported cryptocurrency: ${cryptocurrency}`);
  }

  const fiat = fiatCurrency.toLowerCase();
  if (!SUPPORTED_FIAT.includes(fiat)) {
    throw new Error(`Unsupported fiat currency: ${fiatCurrency}`);
  }

  try {
    const url = `${COINGECKO_API_URL}/simple/price?ids=${coinId}&vs_currencies=${fiat}`;
    const response = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!response.ok) {
      const error: CoinGeckoError = await response.json().catch(() => ({
        error: response.statusText
      }));
      throw new Error(
        `CoinGecko API error: ${error.error || response.statusText}`
      );
    }

    const data: CoinGeckoPriceResponse = await response.json();
    const price = data[coinId]?.[fiat];

    if (!price) {
      throw new Error(
        `Price not found for ${cryptocurrency} in ${fiatCurrency}`
      );
    }

    return price;
  } catch (error) {
    console.error('Error fetching crypto price from CoinGecko:', error);
    throw error;
  }
}

/**
 * Convert fiat amount to cryptocurrency amount
 */
export async function convertFiatToCrypto(
  fiatAmount: number,
  fiatCurrency: string,
  cryptocurrency: string
): Promise<{
  cryptoAmount: string;
  exchangeRate: number;
}> {
  const exchangeRate = await getCryptoPrice(cryptocurrency, fiatCurrency);
  const cryptoAmount = fiatAmount / exchangeRate;

  // Format based on cryptocurrency decimals
  const decimals = getCryptoDecimals(cryptocurrency);
  const formattedAmount = cryptoAmount.toFixed(decimals);

  return {
    cryptoAmount: formattedAmount,
    exchangeRate
  };
}

/**
 * Get number of decimal places for a cryptocurrency
 */
function getCryptoDecimals(cryptocurrency: string): number {
  const decimalsMap: Record<string, number> = {
    btc: 8,
    eth: 18,
    usdt: 6,
    usdc: 6,
    busd: 18,
    bnb: 18,
    sol: 9,
    xrp: 6,
    doge: 8,
    ltc: 8,
    bch: 8,
    trx: 6,
    algo: 6,
    xmr: 12
  };

  return decimalsMap[cryptocurrency.toLowerCase()] || 8;
}

/**
 * Get multiple cryptocurrency prices at once
 */
export async function getMultipleCryptoPrices(
  cryptocurrencies: string[],
  fiatCurrency: string = 'usd'
): Promise<Record<string, number>> {
  const coinIds = cryptocurrencies
    .map((crypto) => COIN_IDS[crypto.toLowerCase()])
    .filter(Boolean)
    .join(',');

  if (!coinIds) {
    throw new Error('No valid cryptocurrencies provided');
  }

  const fiat = fiatCurrency.toLowerCase();
  if (!SUPPORTED_FIAT.includes(fiat)) {
    throw new Error(`Unsupported fiat currency: ${fiatCurrency}`);
  }

  try {
    const url = `${COINGECKO_API_URL}/simple/price?ids=${coinIds}&vs_currencies=${fiat}`;
    const response = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      const error: CoinGeckoError = await response.json().catch(() => ({
        error: response.statusText
      }));
      throw new Error(
        `CoinGecko API error: ${error.error || response.statusText}`
      );
    }

    const data: CoinGeckoPriceResponse = await response.json();
    const result: Record<string, number> = {};

    for (const crypto of cryptocurrencies) {
      const coinId = COIN_IDS[crypto.toLowerCase()];
      if (coinId && data[coinId]?.[fiat]) {
        result[crypto] = data[coinId][fiat];
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching multiple crypto prices:', error);
    throw error;
  }
}

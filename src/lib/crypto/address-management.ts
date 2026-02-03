/**
 * Crypto Address Management Service
 * Handles address selection and rotation similar to Boxcoin
 */

import { prisma } from '@/lib/db';

interface CryptoWallets {
  [cryptocurrency: string]: string[];
}

/**
 * Parse crypto wallets from JSON string
 */
function parseCryptoWallets(walletsJson: string | null): CryptoWallets {
  if (!walletsJson) return {};
  try {
    return JSON.parse(walletsJson);
  } catch {
    return {};
  }
}

/**
 * Get crypto address for a payment (with rotation logic like Boxcoin)
 */
export async function getCryptoAddress(
  organizationId: string,
  cryptocurrency: string
): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  if (!org.cryptoPaymentsEnabled) {
    throw new Error('Crypto payments are not enabled for this organization');
  }

  const crypto = cryptocurrency.toLowerCase();
  const wallets = parseCryptoWallets(org.cryptoWallets);
  const addresses = wallets[crypto] || [];

  if (addresses.length === 0) {
    throw new Error(
      `No ${crypto.toUpperCase()} addresses configured for this organization`
    );
  }

  // Address reuse cooldown (default 24 hours)
  const cooldownHours = org.addressReuseCooldownHours || 24;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const now = new Date();

  // Try to find an address that can be reused
  if (!org.stopReusingAddresses) {
    for (const address of addresses) {
      const trimmedAddress = address.trim();
      if (!trimmedAddress) continue;

      // Check usage history
      const usage = await prisma.cryptoAddressUsage.findUnique({
        where: {
          organizationId_cryptocurrency_address: {
            organizationId,
            cryptocurrency: crypto,
            address: trimmedAddress
          }
        }
      });

      // Can reuse if never used or used more than cooldown hours ago
      const canReuse =
        !usage || now.getTime() - usage.lastUsedAt.getTime() > cooldownMs;

      if (canReuse) {
        // Update usage timestamp
        await prisma.cryptoAddressUsage.upsert({
          where: {
            organizationId_cryptocurrency_address: {
              organizationId,
              cryptocurrency: crypto,
              address: trimmedAddress
            }
          },
          update: { lastUsedAt: now },
          create: {
            organizationId,
            cryptocurrency: crypto,
            address: trimmedAddress,
            lastUsedAt: now
          }
        });

        return trimmedAddress;
      }
    }
  }

  // If stop reusing addresses is enabled, find unused address
  if (org.stopReusingAddresses) {
    for (const address of addresses) {
      const trimmedAddress = address.trim();
      if (!trimmedAddress) continue;

      const usage = await prisma.cryptoAddressUsage.findUnique({
        where: {
          organizationId_cryptocurrency_address: {
            organizationId,
            cryptocurrency: crypto,
            address: trimmedAddress
          }
        }
      });

      if (!usage) {
        // Found unused address
        await prisma.cryptoAddressUsage.create({
          data: {
            organizationId,
            cryptocurrency: crypto,
            address: trimmedAddress,
            lastUsedAt: now
          }
        });

        return trimmedAddress;
      }
    }

    // All addresses used, throw error
    throw new Error(
      `All ${crypto.toUpperCase()} addresses have been used. Please add more addresses or enable address reuse.`
    );
  }

  // Fallback: return first address (even if recently used)
  return addresses[0].trim();
}

/**
 * Get all addresses for a cryptocurrency
 */
export async function getCryptoAddresses(
  organizationId: string,
  cryptocurrency: string
): Promise<string[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!org) {
    return [];
  }

  const wallets = parseCryptoWallets(org.cryptoWallets);
  return (wallets[cryptocurrency.toLowerCase()] || []).map((addr) =>
    addr.trim()
  );
}

/**
 * Add a new address for a cryptocurrency
 */
export async function addCryptoAddress(
  organizationId: string,
  cryptocurrency: string,
  address: string
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  const crypto = cryptocurrency.toLowerCase();
  const wallets = parseCryptoWallets(org.cryptoWallets);
  const addresses = wallets[crypto] || [];

  // Check if address already exists
  if (addresses.includes(address.trim())) {
    throw new Error('Address already exists');
  }

  // Add new address
  addresses.push(address.trim());
  wallets[crypto] = addresses;

  // Update organization
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      cryptoWallets: JSON.stringify(wallets)
    }
  });
}

/**
 * Remove an address for a cryptocurrency
 */
export async function removeCryptoAddress(
  organizationId: string,
  cryptocurrency: string,
  address: string
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  const crypto = cryptocurrency.toLowerCase();
  const wallets = parseCryptoWallets(org.cryptoWallets);
  const addresses = wallets[crypto] || [];

  // Remove address
  wallets[crypto] = addresses.filter((addr) => addr.trim() !== address.trim());

  // Update organization
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      cryptoWallets: JSON.stringify(wallets)
    }
  });

  // Remove usage records
  await prisma.cryptoAddressUsage.deleteMany({
    where: {
      organizationId,
      cryptocurrency: crypto,
      address: address.trim()
    }
  });
}

/**
 * Get address usage statistics
 */
export async function getAddressUsageStats(
  organizationId: string,
  cryptocurrency: string
): Promise<
  Array<{
    address: string;
    lastUsedAt: Date | null;
    timesUsed: number;
  }>
> {
  const addresses = await getCryptoAddresses(organizationId, cryptocurrency);
  const stats = await Promise.all(
    addresses.map(async (address) => {
      const usage = await prisma.cryptoAddressUsage.findUnique({
        where: {
          organizationId_cryptocurrency_address: {
            organizationId,
            cryptocurrency: cryptocurrency.toLowerCase(),
            address
          }
        }
      });

      const payments = await prisma.cryptoPayment.count({
        where: {
          organizationId,
          cryptocurrencyCode: cryptocurrency.toLowerCase(),
          address
        }
      });

      return {
        address,
        lastUsedAt: usage?.lastUsedAt || null,
        timesUsed: payments
      };
    })
  );

  return stats;
}

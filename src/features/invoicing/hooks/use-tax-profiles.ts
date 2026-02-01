import { useQuery } from '@tanstack/react-query';

export interface TaxProfile {
  id: string;
  name: string;
  organizationId: string;
  countryCode: string;
  regionCode?: string | null;
  isDefault: boolean;
  taxRules: Array<{
    id: string;
    name: string;
    rate: number;
    authority?: string | null;
    isActive: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook to fetch tax profiles for the current organization
 */
export function useTaxProfiles() {
  return useQuery<TaxProfile[]>({
    queryKey: ['tax-profiles'],
    queryFn: async () => {
      const response = await fetch('/api/tax/profiles');
      if (!response.ok) {
        throw new Error('Failed to fetch tax profiles');
      }
      return response.json();
    }
  });
}

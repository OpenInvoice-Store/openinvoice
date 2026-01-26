import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface BrandingSettings {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
  footerText?: string | null;
}

export function useBrandingSettings() {
  return useQuery<BrandingSettings>({
    queryKey: ['branding-settings'],
    queryFn: async () => {
      const res = await fetch('/api/organizations/branding');
      if (!res.ok) throw new Error('Failed to fetch branding settings');
      return res.json();
    }
  });
}

export function useUpdateBrandingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BrandingSettings) => {
      const res = await fetch('/api/organizations/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update branding');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding-settings'] });
      toast.success('Branding settings updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update branding settings');
    }
  });
}

export function useUploadBrandingLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<{ url: string }> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding-settings'] });
      toast.success('Logo uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload logo');
    }
  });
}

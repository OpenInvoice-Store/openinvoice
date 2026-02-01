import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface NotificationSettings {
  email: {
    emailProvider: string | null;
    resendApiKey: string | null;
    resendFromEmail: string | null;
    resendFromName: string | null;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUsername: string | null;
    smtpPassword: string | null;
    smtpFromEmail: string | null;
    smtpFromName: string | null;
  };
  sms: {
    twilioAccountSid: string | null;
    twilioAuthToken: string | null;
    twilioFromNumber: string | null;
  };
}

export function useNotificationSettings() {
  return useQuery<NotificationSettings>({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notification settings');
      }
      return response.json();
    }
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email?: {
        emailProvider?: string | null;
        resendApiKey?: string | null;
        resendFromEmail?: string | null;
        resendFromName?: string | null;
        smtpHost?: string | null;
        smtpPort?: number | null;
        smtpSecure?: boolean;
        smtpUsername?: string | null;
        smtpPassword?: string | null;
        smtpFromEmail?: string | null;
        smtpFromName?: string | null;
      };
      sms?: {
        twilioAccountSid?: string | null;
        twilioAuthToken?: string | null;
        twilioFromNumber?: string | null;
      };
    }) => {
      const response = await fetch('/api/organizations/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || 'Failed to update notification settings'
        );
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast.success('Notification settings updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update notification settings');
    }
  });
}

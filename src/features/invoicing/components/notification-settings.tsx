'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import {
  useNotificationSettings,
  useUpdateNotificationSettings
} from '../hooks/use-notifications';
import { Eye, EyeOff } from 'lucide-react';

const notificationSchema = z.object({
  email: z.object({
    emailProvider: z
      .enum(['resend', 'smtp'])
      .optional()
      .nullable()
      .or(z.literal('')),
    resendApiKey: z.string().optional().nullable().or(z.literal('')),
    resendFromEmail: z
      .string()
      .email('Must be a valid email address')
      .optional()
      .nullable()
      .or(z.literal('')),
    resendFromName: z.string().optional().nullable().or(z.literal('')),
    smtpHost: z.string().optional().nullable().or(z.literal('')),
    smtpPort: z
      .string()
      .optional()
      .nullable()
      .or(z.literal(''))
      .refine(
        (val) => {
          if (!val || val === '') return true;
          const port = parseInt(val, 10);
          return !isNaN(port) && port >= 1 && port <= 65535;
        },
        { message: 'Port must be a number between 1 and 65535' }
      ),
    smtpSecure: z.boolean().optional(),
    smtpUsername: z.string().optional().nullable().or(z.literal('')),
    smtpPassword: z.string().optional().nullable().or(z.literal('')),
    smtpFromEmail: z
      .string()
      .email('Must be a valid email address')
      .optional()
      .nullable()
      .or(z.literal('')),
    smtpFromName: z.string().optional().nullable().or(z.literal(''))
  }),
  sms: z.object({
    twilioAccountSid: z.string().optional().nullable().or(z.literal('')),
    twilioAuthToken: z.string().optional().nullable().or(z.literal('')),
    twilioFromNumber: z
      .string()
      .regex(/^\+[1-9]\d{1,14}$/, 'Must be in E.164 format (e.g., +1234567890)')
      .optional()
      .nullable()
      .or(z.literal(''))
  })
});

type NotificationFormData = z.infer<typeof notificationSchema>;

export function NotificationSettings() {
  const [showEmailApiKey, setShowEmailApiKey] = useState(false);
  const [showSmsAuthToken, setShowSmsAuthToken] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  const { data: settings, isLoading } = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      email: {
        emailProvider: null,
        resendApiKey: null,
        resendFromEmail: null,
        resendFromName: null,
        smtpHost: null,
        smtpPort: null,
        smtpSecure: false,
        smtpUsername: null,
        smtpPassword: null,
        smtpFromEmail: null,
        smtpFromName: null
      },
      sms: {
        twilioAccountSid: null,
        twilioAuthToken: null,
        twilioFromNumber: null
      }
    }
  });

  const emailProvider = form.watch('email.emailProvider');

  // Update form when data loads
  useEffect(() => {
    if (settings) {
      form.reset({
        email: {
          emailProvider:
            settings.email.emailProvider === 'resend' ||
            settings.email.emailProvider === 'smtp'
              ? settings.email.emailProvider
              : null,
          resendApiKey: settings.email.resendApiKey || null,
          resendFromEmail: settings.email.resendFromEmail || null,
          resendFromName: settings.email.resendFromName || null,
          smtpHost: settings.email.smtpHost || null,
          smtpPort: settings.email.smtpPort?.toString() || null,
          smtpSecure: settings.email.smtpSecure || false,
          smtpUsername: settings.email.smtpUsername || null,
          smtpPassword: settings.email.smtpPassword || null,
          smtpFromEmail: settings.email.smtpFromEmail || null,
          smtpFromName: settings.email.smtpFromName || null
        },
        sms: {
          twilioAccountSid: settings.sms.twilioAccountSid || null,
          twilioAuthToken: settings.sms.twilioAuthToken || null,
          twilioFromNumber: settings.sms.twilioFromNumber || null
        }
      });
    }
  }, [settings, form]);

  const onSubmit = (data: NotificationFormData) => {
    // Convert empty strings to null
    const cleanedData = {
      email: {
        emailProvider:
          data.email.emailProvider === '' ? null : data.email.emailProvider,
        resendApiKey:
          data.email.resendApiKey === '' ? null : data.email.resendApiKey,
        resendFromEmail:
          data.email.resendFromEmail === '' ? null : data.email.resendFromEmail,
        resendFromName:
          data.email.resendFromName === '' ? null : data.email.resendFromName,
        smtpHost: data.email.smtpHost === '' ? null : data.email.smtpHost,
        smtpPort:
          data.email.smtpPort === '' || !data.email.smtpPort
            ? null
            : parseInt(data.email.smtpPort, 10),
        smtpSecure: data.email.smtpSecure || false,
        smtpUsername:
          data.email.smtpUsername === '' ? null : data.email.smtpUsername,
        smtpPassword:
          data.email.smtpPassword === '' ? null : data.email.smtpPassword,
        smtpFromEmail:
          data.email.smtpFromEmail === '' ? null : data.email.smtpFromEmail,
        smtpFromName:
          data.email.smtpFromName === '' ? null : data.email.smtpFromName
      },
      sms: {
        twilioAccountSid:
          data.sms.twilioAccountSid === '' ? null : data.sms.twilioAccountSid,
        twilioAuthToken:
          data.sms.twilioAuthToken === '' ? null : data.sms.twilioAuthToken,
        twilioFromNumber:
          data.sms.twilioFromNumber === '' ? null : data.sms.twilioFromNumber
      }
    };
    updateSettings.mutate(cleanedData);
  };

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  return (
    <Form
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      className='space-y-6'
    >
      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>
            Configure your email settings. Choose between Resend or SMTP. If not
            set, the system will use environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <FormField
            control={form.control}
            name='email.emailProvider'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Provider</FormLabel>
                <Select
                  onValueChange={(value) =>
                    field.onChange(value === '' ? null : value)
                  }
                  value={field.value || ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select email provider' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='resend'>Resend</SelectItem>
                    <SelectItem value='smtp'>SMTP</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose your email service provider
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Resend Configuration */}
          {emailProvider === 'resend' && (
            <>
              <FormField
                control={form.control}
                name='email.resendApiKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resend API Key</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showEmailApiKey ? 'text' : 'password'}
                          placeholder='re_...'
                          {...field}
                          value={field.value || ''}
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                          onClick={() => setShowEmailApiKey(!showEmailApiKey)}
                        >
                          {showEmailApiKey ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Your Resend API key. Get it from{' '}
                      <a
                        href='https://resend.com/api-keys'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary underline'
                      >
                        resend.com/api-keys
                      </a>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='email.resendFromEmail'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='noreply@example.com'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Email address to send from (must be verified in Resend)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='email.resendFromName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Your Company Name'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name for sent emails
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* SMTP Configuration */}
          {emailProvider === 'smtp' && (
            <>
              <FormField
                control={form.control}
                name='email.smtpHost'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Host</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='smtp.gmail.com'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      SMTP server hostname (e.g., smtp.gmail.com,
                      smtp.sendgrid.net)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='email.smtpPort'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Port</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          placeholder='587'
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Port number (587 for TLS, 465 for SSL)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='email.smtpSecure'
                  render={({ field }) => (
                    <FormItem className='flex flex-col justify-end'>
                      <FormLabel>Use SSL/TLS</FormLabel>
                      <FormControl>
                        <div className='flex items-center space-x-2'>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <span className='text-muted-foreground text-sm'>
                            {field.value ? 'SSL (port 465)' : 'TLS (port 587)'}
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='email.smtpUsername'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Username</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='your-email@example.com'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Your SMTP username (usually your email address)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='email.smtpPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Password</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showSmtpPassword ? 'text' : 'password'}
                          placeholder='Your SMTP password or app password'
                          {...field}
                          value={field.value || ''}
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        >
                          {showSmtpPassword ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Your SMTP password or app-specific password
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='email.smtpFromEmail'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='noreply@example.com'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Email address to send from
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='email.smtpFromName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Your Company Name'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name for sent emails
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* SMS Settings */}
      <Card>
        <CardHeader>
          <CardTitle>SMS Configuration (Twilio)</CardTitle>
          <CardDescription>
            Configure your SMS settings. If not set, the system will use
            environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <FormField
            control={form.control}
            name='sms.twilioAccountSid'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Twilio Account SID</FormLabel>
                <FormControl>
                  <Input
                    placeholder='AC...'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Your Twilio Account SID from{' '}
                  <a
                    href='https://console.twilio.com'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary underline'
                  >
                    console.twilio.com
                  </a>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='sms.twilioAuthToken'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Twilio Auth Token</FormLabel>
                <FormControl>
                  <div className='relative'>
                    <Input
                      type={showSmsAuthToken ? 'text' : 'password'}
                      placeholder='Your auth token'
                      {...field}
                      value={field.value || ''}
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                      onClick={() => setShowSmsAuthToken(!showSmsAuthToken)}
                    >
                      {showSmsAuthToken ? (
                        <EyeOff className='h-4 w-4' />
                      ) : (
                        <Eye className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>
                  Your Twilio Auth Token (keep this secret)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='sms.twilioFromNumber'
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Phone Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder='+1234567890'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Twilio phone number in E.164 format (e.g., +1234567890)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button type='submit' disabled={updateSettings.isPending}>
          {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </Form>
  );
}

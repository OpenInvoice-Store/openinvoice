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
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { IconUpload, IconX } from '@tabler/icons-react';
import {
  useBrandingSettings,
  useUpdateBrandingSettings,
  useUploadBrandingLogo
} from '../hooks/use-branding';

const brandingSchema = z.object({
  logoUrl: z.string().url().optional().nullable().or(z.literal('')),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color (e.g., #FF5733)')
    .optional()
    .nullable()
    .or(z.literal('')),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color (e.g., #FF5733)')
    .optional()
    .nullable()
    .or(z.literal('')),
  fontFamily: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  companyEmail: z
    .string()
    .email('Must be a valid email address')
    .optional()
    .nullable()
    .or(z.literal('')),
  companyWebsite: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  footerText: z.string().optional().nullable()
});

type BrandingFormData = z.infer<typeof brandingSchema>;

export function BrandingSettings() {
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data: branding, isLoading } = useBrandingSettings();
  const updateBranding = useUpdateBrandingSettings();
  const uploadLogo = useUploadBrandingLogo();

  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      fontFamily: null,
      companyAddress: null,
      companyPhone: null,
      companyEmail: null,
      companyWebsite: null,
      footerText: null
    }
  });

  // Update form when data loads
  useEffect(() => {
    if (branding) {
      form.reset({
        logoUrl: branding.logoUrl || null,
        primaryColor: branding.primaryColor || null,
        secondaryColor: branding.secondaryColor || null,
        fontFamily: branding.fontFamily || null,
        companyAddress: branding.companyAddress || null,
        companyPhone: branding.companyPhone || null,
        companyEmail: branding.companyEmail || null,
        companyWebsite: branding.companyWebsite || null,
        footerText: branding.footerText || null
      });
    }
  }, [branding, form]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const data = await uploadLogo.mutateAsync(file);
      form.setValue('logoUrl', data.url);
    } catch (error) {
      // Error is handled by the hook
      console.error('Error uploading logo:', error);
    } finally {
      setUploadingLogo(false);
    }
  };

  const onSubmit = (data: BrandingFormData) => {
    // Convert empty strings to null
    const cleanedData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value === '' ? null : value
      ])
    ) as BrandingFormData;
    updateBranding.mutate(cleanedData);
  };

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  const logoUrl = form.watch('logoUrl');
  const primaryColor = form.watch('primaryColor') || '#2563eb';
  const secondaryColor = form.watch('secondaryColor') || '#64748b';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding Settings</CardTitle>
        <CardDescription>
          Customize your company branding for invoices and emails
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
        >
          {/* Logo Upload */}
          <FormField
            control={form.control}
            name='logoUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Logo</FormLabel>
                <div className='space-y-4'>
                  {logoUrl && (
                    <div className='relative inline-block'>
                      <img
                        src={logoUrl}
                        alt='Company logo'
                        className='h-20 w-auto rounded border object-contain'
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='absolute -top-2 -right-2 h-6 w-6 rounded-full p-0'
                        onClick={() => {
                          form.setValue('logoUrl', null);
                        }}
                      >
                        <IconX className='h-4 w-4' />
                      </Button>
                    </div>
                  )}
                  <div>
                    <Input
                      type='file'
                      accept='image/*'
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo || uploadLogo.isPending}
                      className='hidden'
                      id='logo-upload'
                    />
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() =>
                        document.getElementById('logo-upload')?.click()
                      }
                      disabled={uploadingLogo || uploadLogo.isPending}
                    >
                      <IconUpload className='mr-2 h-4 w-4' />
                      {uploadingLogo || uploadLogo.isPending
                        ? 'Uploading...'
                        : 'Upload Logo'}
                    </Button>
                    <FormDescription>
                      Upload your company logo (PNG, JPG, or SVG). Recommended
                      size: 200x50px
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      placeholder='Or enter logo URL directly'
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Color Scheme */}
          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='primaryColor'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Color</FormLabel>
                  <div className='flex gap-2'>
                    <FormControl>
                      <Input
                        type='color'
                        {...field}
                        value={field.value || '#2563eb'}
                        onChange={(e) => field.onChange(e.target.value)}
                        className='h-10 w-20'
                      />
                    </FormControl>
                    <Input
                      placeholder='#2563eb'
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </div>
                  <FormDescription>
                    Primary brand color for invoices
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='secondaryColor'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Color</FormLabel>
                  <div className='flex gap-2'>
                    <FormControl>
                      <Input
                        type='color'
                        {...field}
                        value={field.value || '#64748b'}
                        onChange={(e) => field.onChange(e.target.value)}
                        className='h-10 w-20'
                      />
                    </FormControl>
                    <Input
                      placeholder='#64748b'
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </div>
                  <FormDescription>
                    Secondary brand color for invoices
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Font Family */}
          <FormField
            control={form.control}
            name='fontFamily'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Font Family</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g., Inter, Roboto, Arial'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Font family for invoices (default: system fonts)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Company Information */}
          <div className='space-y-4 border-t pt-4'>
            <h3 className='text-lg font-semibold'>Company Information</h3>

            <FormField
              control={form.control}
              name='companyAddress'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='123 Main St, City, State, ZIP'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Company address to display on invoices
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='companyPhone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='+1 (555) 123-4567'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='companyEmail'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Email</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='contact@company.com'
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='companyWebsite'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Website</FormLabel>
                  <FormControl>
                    <Input
                      type='url'
                      placeholder='https://company.com'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Footer Text */}
          <FormField
            control={form.control}
            name='footerText'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Footer Text</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Thank you for your business!'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Custom footer text to display on invoices
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Preview */}
          <div className='border-t pt-4'>
            <h3 className='mb-4 text-lg font-semibold'>Preview</h3>
            <div
              className='rounded-lg border p-6'
              style={{
                backgroundColor: '#ffffff',
                color: '#1a1a1a',
                fontFamily: form.watch('fontFamily') || 'inherit'
              }}
            >
              <div className='mb-4 flex items-center justify-between border-b pb-4'>
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt='Logo'
                    className='h-12 w-auto object-contain'
                  />
                )}
                <div
                  className='text-2xl font-bold'
                  style={{ color: primaryColor }}
                >
                  INVOICE
                </div>
              </div>
              <div className='space-y-2 text-sm'>
                {form.watch('companyAddress') && (
                  <p>{form.watch('companyAddress')}</p>
                )}
                <div className='flex gap-4'>
                  {form.watch('companyPhone') && (
                    <p>{form.watch('companyPhone')}</p>
                  )}
                  {form.watch('companyEmail') && (
                    <p>{form.watch('companyEmail')}</p>
                  )}
                </div>
                {form.watch('companyWebsite') && (
                  <p>
                    <a
                      href={form.watch('companyWebsite') || '#'}
                      style={{ color: primaryColor }}
                    >
                      {form.watch('companyWebsite')}
                    </a>
                  </p>
                )}
              </div>
              {form.watch('footerText') && (
                <div
                  className='mt-4 border-t pt-4 text-center text-sm'
                  style={{ color: secondaryColor }}
                >
                  {form.watch('footerText')}
                </div>
              )}
            </div>
          </div>

          <div className='flex justify-end'>
            <Button type='submit' disabled={updateBranding.isPending}>
              {updateBranding.isPending ? 'Saving...' : 'Save Branding'}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}

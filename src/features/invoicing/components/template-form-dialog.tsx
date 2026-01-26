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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useEffect } from 'react';
import {
  useCreateInvoiceTemplate,
  useUpdateInvoiceTemplate
} from '../hooks/use-templates';

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  layout: z.enum(['standard', 'compact', 'detailed']),
  headerTemplate: z.string().nullable().optional(),
  footerTemplate: z.string().nullable().optional(),
  isDefault: z.boolean()
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: {
    id: string;
    name: string;
    layout: string | null;
    headerTemplate: string | null;
    footerTemplate: string | null;
    isDefault: boolean;
  } | null;
  onSuccess?: () => void;
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSuccess
}: TemplateFormDialogProps) {
  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      layout: 'standard',
      headerTemplate: null,
      footerTemplate: null,
      isDefault: false
    }
  });

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        layout:
          (template.layout as 'standard' | 'compact' | 'detailed') ||
          'standard',
        headerTemplate: template.headerTemplate || null,
        footerTemplate: template.footerTemplate || null,
        isDefault: template.isDefault
      });
    } else {
      form.reset({
        name: '',
        layout: 'standard',
        headerTemplate: null,
        footerTemplate: null,
        isDefault: false
      });
    }
  }, [template, form]);

  const createTemplate = useCreateInvoiceTemplate();
  const updateTemplate = useUpdateInvoiceTemplate();

  const createMutation = {
    mutate: (data: TemplateFormData) => {
      createTemplate.mutate(data, {
        onSuccess: () => {
          onSuccess?.();
        }
      });
    },
    isPending: createTemplate.isPending
  };

  const updateMutation = {
    mutate: (data: TemplateFormData) => {
      if (!template) return;
      updateTemplate.mutate(
        {
          id: template.id,
          ...data
        },
        {
          onSuccess: () => {
            onSuccess?.();
          }
        }
      );
    },
    isPending: updateTemplate.isPending
  };

  const onSubmit = (data: TemplateFormData) => {
    if (template) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
          <DialogDescription>
            {template
              ? 'Update your invoice template settings'
              : 'Create a new custom invoice template'}
          </DialogDescription>
        </DialogHeader>

        <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
          <div className='space-y-4 py-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Modern, Classic, Minimal'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this template
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='layout'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Layout</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select layout' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='standard'>Standard</SelectItem>
                      <SelectItem value='compact'>Compact</SelectItem>
                      <SelectItem value='detailed'>Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the layout style for this template
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='headerTemplate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Header (HTML)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='<div>Custom header content</div>'
                      {...field}
                      value={field.value || ''}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional custom HTML for the invoice header
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='footerTemplate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Footer (HTML)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='<div>Custom footer content</div>'
                      {...field}
                      value={field.value || ''}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional custom HTML for the invoice footer
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!template?.isDefault && (
              <FormField
                control={form.control}
                name='isDefault'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                    <FormControl>
                      <input
                        type='checkbox'
                        checked={field.value}
                        onChange={field.onChange}
                        className='h-4 w-4 rounded border-gray-300'
                      />
                    </FormControl>
                    <div className='space-y-1 leading-none'>
                      <FormLabel>Set as Default Template</FormLabel>
                      <FormDescription>
                        Make this the default template for new invoices
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading}>
              {isLoading
                ? template
                  ? 'Updating...'
                  : 'Creating...'
                : template
                  ? 'Update Template'
                  : 'Create Template'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

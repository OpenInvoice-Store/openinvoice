'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useRecurringInvoice,
  useUpdateRecurringInvoice,
  type RecurringInvoiceTemplateItem
} from '@/features/invoicing/hooks/use-recurring-invoices';
import { useProducts } from '@/features/invoicing/hooks/use-products';
import { formatCurrency } from '@/lib/format';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  IconEdit,
  IconCheck,
  IconX,
  IconPlus,
  IconTrash
} from '@tabler/icons-react';

const itemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be positive'),
  taxRate: z.number().min(0).max(100)
});

const itemsFormSchema = z.object({
  items: z.array(itemSchema).min(1, 'At least one item is required')
});

type ItemsFormData = z.infer<typeof itemsFormSchema>;

export default function RecurringInvoiceItemsPage() {
  const params = useParams();
  const id = params?.id as string;
  const templateQuery = useRecurringInvoice(id);
  const { data: template, isLoading } = templateQuery;
  const { data: products } = useProducts();
  const updateTemplate = useUpdateRecurringInvoice();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<ItemsFormData>({
    resolver: zodResolver(itemsFormSchema),
    defaultValues: {
      items: [
        { productId: '', description: '', quantity: 1, price: 0, taxRate: 0 }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  });

  useEffect(() => {
    if (template && !isEditing) {
      const items = JSON.parse(
        template.templateItems
      ) as RecurringInvoiceTemplateItem[];
      form.reset({ items });
    }
  }, [template, isEditing, form]);

  const handleProductChange = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.description`, product.name);
      form.setValue(`items.${index}.price`, product.price);
      form.setValue(`items.${index}.taxRate`, product.taxRate || 0);
    }
  };

  const handleEdit = () => {
    if (template) {
      const items = JSON.parse(
        template.templateItems
      ) as RecurringInvoiceTemplateItem[];
      form.reset({ items });
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (template) {
      const items = JSON.parse(
        template.templateItems
      ) as RecurringInvoiceTemplateItem[];
      form.reset({ items });
    }
    setIsEditing(false);
  };

  const handleSave = async (data: ItemsFormData) => {
    try {
      await updateTemplate.mutateAsync({
        id: template!.id,
        templateItems: data.items
      });
      toast.success('Items updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update items'
      );
    }
  };

  if (isLoading) {
    return <div className='text-muted-foreground p-4 text-sm'>Loading...</div>;
  }

  if (!template) {
    return (
      <div className='text-muted-foreground p-4 text-sm'>
        Template not found
      </div>
    );
  }

  const items = isEditing
    ? form.watch('items')
    : (JSON.parse(template.templateItems) as RecurringInvoiceTemplateItem[]);

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );
  const tax = items.reduce(
    (sum: number, item: any) =>
      sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  const total = subtotal + tax;

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Invoice Items</CardTitle>
              <CardDescription>
                Items that will be included in each generated invoice
              </CardDescription>
            </div>
            {!isEditing && (
              <Button variant='outline' size='sm' onClick={handleEdit}>
                <IconEdit className='mr-2 h-4 w-4' />
                Edit Items
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Form form={form} onSubmit={form.handleSubmit(handleSave)}>
              <div className='space-y-4'>
                <div className='space-y-4'>
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className='grid grid-cols-12 items-end gap-2 rounded-lg border p-4'
                    >
                      <div className='col-span-12 md:col-span-4'>
                        <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='text-xs'>Product</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  handleProductChange(index, value);
                                }}
                                value={field.value || ''}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder='Select product' />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products?.map((product) => (
                                    <SelectItem
                                      key={product.id}
                                      value={product.id}
                                    >
                                      {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className='col-span-12 md:col-span-4'>
                        <FormField
                          control={form.control}
                          name={`items.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='text-xs'>
                                Description
                              </FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className='col-span-6 md:col-span-1'>
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='text-xs'>Qty</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  min={1}
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  value={field.value}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className='col-span-6 md:col-span-1'>
                        <FormField
                          control={form.control}
                          name={`items.${index}.price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='text-xs'>Price</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  step='0.01'
                                  min={0}
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  value={field.value}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className='col-span-6 md:col-span-1'>
                        <FormField
                          control={form.control}
                          name={`items.${index}.taxRate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='text-xs'>Tax %</FormLabel>
                              <FormControl>
                                <Input
                                  type='number'
                                  step='0.01'
                                  min={0}
                                  max={100}
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  value={field.value}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className='col-span-6 flex items-center justify-end md:col-span-1'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <IconTrash className='text-destructive h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className='flex items-center justify-between border-t pt-4'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      append({
                        productId: '',
                        description: '',
                        quantity: 1,
                        price: 0,
                        taxRate: 0
                      })
                    }
                  >
                    <IconPlus className='mr-2 h-4 w-4' />
                    Add Item
                  </Button>
                  <div className='flex gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={handleCancel}
                    >
                      <IconX className='mr-2 h-4 w-4' />
                      Cancel
                    </Button>
                    <Button
                      type='submit'
                      size='sm'
                      disabled={updateTemplate.isPending}
                    >
                      <IconCheck className='mr-2 h-4 w-4' />
                      {updateTemplate.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>

                <div className='mt-4 flex justify-end space-x-4 border-t pt-4 text-sm'>
                  <div className='text-right'>
                    <div className='text-muted-foreground'>
                      Subtotal: {formatCurrency(subtotal)}
                    </div>
                    <div className='text-muted-foreground'>
                      Tax: {formatCurrency(tax)}
                    </div>
                    <div className='font-semibold'>
                      Total: {formatCurrency(total)}
                    </div>
                  </div>
                </div>
              </div>
            </Form>
          ) : (
            <>
              <Table className='text-sm'>
                <TableHeader>
                  <TableRow>
                    <TableHead className='text-muted-foreground font-medium'>
                      Description
                    </TableHead>
                    <TableHead className='text-muted-foreground font-medium'>
                      Quantity
                    </TableHead>
                    <TableHead className='text-muted-foreground text-right font-medium'>
                      Price
                    </TableHead>
                    <TableHead className='text-muted-foreground text-right font-medium'>
                      Tax Rate
                    </TableHead>
                    <TableHead className='text-muted-foreground text-right font-medium'>
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any, index: number) => {
                    const itemTotal =
                      item.price * item.quantity * (1 + item.taxRate / 100);
                    return (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className='text-right'>
                          {formatCurrency(item.price)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {item.taxRate}%
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatCurrency(itemTotal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className='mt-4 flex justify-end space-x-4 border-t pt-4 text-sm'>
                <div className='text-right'>
                  <div className='text-muted-foreground'>
                    Subtotal: {formatCurrency(subtotal)}
                  </div>
                  <div className='text-muted-foreground'>
                    Tax: {formatCurrency(tax)}
                  </div>
                  <div className='font-semibold'>
                    Total: {formatCurrency(total)}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import {
  useCustomer,
  useCustomerPayments
} from '@/features/invoicing/hooks/use-customers';
import { formatDate, formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconMail, IconPhone, IconMapPin } from '@tabler/icons-react';
import { TruncatedText } from '@/components/ui/truncated-text';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { flexRender } from '@tanstack/react-table';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState
} from '@tanstack/react-table';
import { customerInvoiceColumns } from '@/features/invoicing/components/customer-tables/invoice-columns';
import { useState } from 'react';

export default function CustomerDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const customerQuery = useCustomer(id);
  const { data: customer, isLoading } = customerQuery;
  const { data: payments = [] } = useCustomerPayments(id);

  // Invoice table state
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([]);
  const [invoiceColumnFilters, setInvoiceColumnFilters] =
    useState<ColumnFiltersState>([]);

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!customer) {
    return <div className='p-4'>Customer not found</div>;
  }

  const invoices = customer?.invoices || [];
  const totalInvoices = invoices.length;
  const totalInvoiceAmount = invoices.reduce((sum, invoice) => {
    const subtotal = invoice.items.reduce(
      (itemSum, item) => itemSum + item.price * item.quantity,
      0
    );
    const tax = invoice.items.reduce(
      (itemSum, item) =>
        itemSum + item.price * item.quantity * (item.taxRate / 100),
      0
    );
    return sum + subtotal + tax;
  }, 0);
  const totalPayments = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  // Invoice table
  const invoiceTable = useReactTable({
    data: invoices,
    columns: customerInvoiceColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setInvoiceSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setInvoiceColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: invoiceSorting,
      columnFilters: invoiceColumnFilters
    },
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  });

  return (
    <div className='space-y-6 p-6'>
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {customer.email && (
              <div className='flex items-start gap-2'>
                <IconMail className='text-muted-foreground mt-0.5 h-4 w-4' />
                <div>
                  <div className='text-sm font-medium'>Email</div>
                  <div className='text-muted-foreground text-sm'>
                    {customer.email}
                  </div>
                </div>
              </div>
            )}
            {customer.phone && (
              <div className='flex items-start gap-2'>
                <IconPhone className='text-muted-foreground mt-0.5 h-4 w-4' />
                <div>
                  <div className='text-sm font-medium'>Phone</div>
                  <div className='text-muted-foreground text-sm'>
                    {customer.phone}
                  </div>
                </div>
              </div>
            )}
            {customer.address && (
              <div className='flex items-start gap-2'>
                <IconMapPin className='text-muted-foreground mt-0.5 h-4 w-4' />
                <div className='min-w-0 flex-1'>
                  <div className='text-sm font-medium'>Address</div>
                  <div className='text-muted-foreground text-sm'>
                    <TruncatedText text={customer.address} maxLength={50} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Total Invoices:</span>
              <span className='font-semibold'>{totalInvoices}</span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>
                Total Invoice Amount:
              </span>
              <span className='font-semibold'>
                {formatCurrency(totalInvoiceAmount)}
              </span>
            </div>
            <div className='flex justify-between border-t pt-2 text-sm'>
              <span className='text-muted-foreground'>Total Payments:</span>
              <span className='font-semibold text-green-600'>
                {formatCurrency(totalPayments)}
              </span>
            </div>
            <div className='flex justify-between border-t pt-2 text-sm'>
              <span className='text-muted-foreground'>Created:</span>
              <span>{formatDate(customer.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invoices ({totalInvoices})</CardTitle>
          </CardHeader>
          <CardContent className='p-0'>
            <div className='flex flex-col space-y-4 p-4'>
              <DataTableToolbar table={invoiceTable} />
              <div className='relative w-full overflow-hidden rounded-md border'>
                <div className='max-h-[600px] overflow-auto'>
                  <table className='w-full caption-bottom text-sm'>
                    <thead className='bg-muted sticky top-0 z-10'>
                      {invoiceTable.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              colSpan={header.colSpan}
                              className='text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0'
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {invoiceTable.getRowModel().rows?.length ? (
                        invoiceTable.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            className='hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors'
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                className='p-4 align-middle [&:has([role=checkbox])]:pr-0'
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={invoiceTable.getAllColumns().length}
                            className='h-24 text-center'
                          >
                            No results.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className='flex flex-col gap-2.5'>
                <DataTablePagination table={invoiceTable} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

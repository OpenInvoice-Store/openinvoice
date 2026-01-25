'use client';

import { useParams } from 'next/navigation';
import { useCustomer, useCustomerPayments } from '../hooks/use-customers';
import { Payment } from '../hooks/use-payments';
import { formatDate, formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  IconEdit,
  IconNotes,
  IconCurrencyDollar,
  IconMail,
  IconPhone,
  IconMapPin,
  IconCreditCard
} from '@tabler/icons-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { CustomerPaymentMethods } from './customer-payment-methods';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { flexRender } from '@tanstack/react-table';
import { TruncatedText } from '@/components/ui/truncated-text';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState
} from '@tanstack/react-table';
import { customerInvoiceColumns } from './customer-tables/invoice-columns';
import { customerPaymentColumns } from './customer-tables/payment-columns';

type CustomerSection = 'details' | 'payments' | 'payment-methods';

export function CustomerView() {
  const params = useParams();
  const id = params?.id as string;
  const customerQuery = useCustomer(id);
  const { data: customer, isLoading } = customerQuery;
  const { data: payments = [], isLoading: isLoadingPayments } =
    useCustomerPayments(id);
  const [activeSection, setActiveSection] =
    useState<CustomerSection>('details');

  // Invoice table state - must be called before any conditional returns
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([]);
  const [invoiceColumnFilters, setInvoiceColumnFilters] =
    useState<ColumnFiltersState>([]);

  // Payment table state - must be called before any conditional returns
  const [paymentSorting, setPaymentSorting] = useState<SortingState>([]);
  const [paymentColumnFilters, setPaymentColumnFilters] =
    useState<ColumnFiltersState>([]);

  // Get all invoices for this customer
  const invoices = customer?.invoices || [];

  // Invoice table - must be called before any conditional returns
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

  // Payment table - must be called before any conditional returns
  const paymentTable = useReactTable({
    data: payments,
    columns: customerPaymentColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setPaymentSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setPaymentColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: paymentSorting,
      columnFilters: paymentColumnFilters
    },
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  });

  // Conditional returns must come after all hooks
  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!customer) {
    return <div className='p-4'>Customer not found</div>;
  }

  // Calculate total payments
  const totalPayments = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );
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

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>{customer.name}</h2>
          {customer.email && (
            <p className='text-muted-foreground mt-1 text-sm'>
              {customer.email}
            </p>
          )}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' asChild>
            <Link href={`/dashboard/customers/${id}/edit`}>
              <IconEdit className='mr-2 h-4 w-4' /> Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Main layout: left section nav + right content */}
      <div className='mt-2 grid gap-6 md:grid-cols-12'>
        {/* Section navigation */}
        <div className='flex h-full flex-col p-3 md:col-span-3'>
          <div className='text-muted-foreground mb-2 px-1 text-xs font-semibold tracking-wide uppercase'>
            Sections
          </div>
          <div className='flex flex-col gap-1'>
            <Button
              variant={activeSection === 'details' ? 'default' : 'ghost'}
              size='sm'
              className='justify-start gap-2'
              onClick={() => setActiveSection('details')}
            >
              <IconNotes className='h-4 w-4' />
              Details
            </Button>
            <Button
              variant={activeSection === 'payments' ? 'default' : 'ghost'}
              size='sm'
              className='justify-start gap-2'
              onClick={() => setActiveSection('payments')}
            >
              <IconCurrencyDollar className='h-4 w-4' />
              Payments
              {payments.length > 0 && (
                <span className='ml-auto rounded-full bg-emerald-100 px-2 text-xs font-medium text-emerald-700'>
                  {payments.length}
                </span>
              )}
            </Button>
            <Button
              variant={
                activeSection === 'payment-methods' ? 'default' : 'ghost'
              }
              size='sm'
              className='justify-start gap-2'
              onClick={() => setActiveSection('payment-methods')}
            >
              <IconCreditCard className='h-4 w-4' />
              Payment Methods
            </Button>
          </div>
        </div>

        {/* Section content */}
        <div className='space-y-6 md:col-span-9'>
          {activeSection === 'details' && (
            <>
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
                            <TruncatedText
                              text={customer.address}
                              maxLength={50}
                            />
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
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Total Invoices:
                      </span>
                      <span className='font-semibold'>{totalInvoices}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Total Invoice Amount:
                      </span>
                      <span className='font-semibold'>
                        {formatCurrency(totalInvoiceAmount)}
                      </span>
                    </div>
                    <div className='flex justify-between border-t pt-2'>
                      <span className='text-muted-foreground'>
                        Total Payments:
                      </span>
                      <span className='font-semibold text-green-600'>
                        {formatCurrency(totalPayments)}
                      </span>
                    </div>
                    <div className='flex justify-between border-t pt-2'>
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
                              {invoiceTable
                                .getHeaderGroups()
                                .map((headerGroup) => (
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
                                    colSpan={
                                      invoiceTable.getAllColumns().length
                                    }
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
            </>
          )}

          {activeSection === 'payments' && (
            <Card>
              <CardHeader>
                <CardTitle>Payments & Receipts</CardTitle>
              </CardHeader>
              <CardContent className='space-y-6 p-0'>
                {isLoadingPayments ? (
                  <div className='p-4'>Loading payments...</div>
                ) : payments.length === 0 ? (
                  <p className='text-muted-foreground px-4 py-4 text-sm'>
                    No payments recorded for this customer.
                  </p>
                ) : (
                  <div className='flex flex-col space-y-4 overflow-hidden p-4'>
                    <DataTableToolbar table={paymentTable} />
                    <div className='relative w-full overflow-hidden rounded-md border'>
                      <div className='max-h-[600px] overflow-auto'>
                        <table className='w-full caption-bottom text-sm'>
                          <thead className='bg-muted sticky top-0 z-10'>
                            {paymentTable
                              .getHeaderGroups()
                              .map((headerGroup) => (
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
                            {paymentTable.getRowModel().rows?.length ? (
                              paymentTable.getRowModel().rows.map((row) => (
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
                                  colSpan={paymentTable.getAllColumns().length}
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
                      <DataTablePagination table={paymentTable} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === 'payment-methods' && (
            <CustomerPaymentMethods customerId={id} />
          )}
        </div>
      </div>
    </div>
  );
}

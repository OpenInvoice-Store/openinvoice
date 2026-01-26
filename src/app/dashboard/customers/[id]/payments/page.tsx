'use client';

import { useParams } from 'next/navigation';
import { useCustomerPayments } from '@/features/invoicing/hooks/use-customers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { customerPaymentColumns } from '@/features/invoicing/components/customer-tables/payment-columns';
import { useState } from 'react';

export default function CustomerPaymentsPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: payments = [], isLoading: isLoadingPayments } =
    useCustomerPayments(id);

  // Payment table state
  const [paymentSorting, setPaymentSorting] = useState<SortingState>([]);
  const [paymentColumnFilters, setPaymentColumnFilters] =
    useState<ColumnFiltersState>([]);

  // Payment table
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

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <CardTitle>Payments & Receipts</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6 p-0'>
          {isLoadingPayments ? (
            <div className='text-muted-foreground p-4 text-sm'>
              Loading payments...
            </div>
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
                      {paymentTable.getHeaderGroups().map((headerGroup) => (
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
    </div>
  );
}

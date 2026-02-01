'use client';

import {
  useRecurringInvoices,
  useDeleteRecurringInvoice,
  useGenerateRecurringInvoice,
  type RecurringInvoiceTemplate
} from '../hooks/use-recurring-invoices';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { columns } from './recurring-invoice-tables/columns';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState
} from '@tanstack/react-table';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RecurringInvoicesList() {
  const router = useRouter();
  const { data: templates = [], isLoading, error } = useRecurringInvoices();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: templates,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters
    },
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  });

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (error) {
    return (
      <div className='text-destructive p-4'>
        Error loading recurring invoices:{' '}
        {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const handleRowClick = (template: RecurringInvoiceTemplate) => {
    router.push(`/dashboard/recurring-invoices/${template.id}`);
  };

  return (
    <div className='h-[calc(100vh-250px)] min-h-[400px] w-full'>
      <DataTable table={table} onRowClick={handleRowClick}>
        <DataTableToolbar table={table} />
      </DataTable>
    </div>
  );
}

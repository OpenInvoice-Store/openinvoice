'use client';

import { useInvoices, type Invoice } from '../hooks/use-invoices';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { columns } from './invoice-tables/columns';
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
import { ExportButton } from '@/components/export-button';

export function InvoicesList() {
  const router = useRouter();
  const { data: invoices = [], isLoading, error } = useInvoices();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: invoices,
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
        Error loading invoices:{' '}
        {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const handleRowClick = (invoice: Invoice) => {
    router.push(`/dashboard/invoices/${invoice.id}`);
  };

  // Get current filters for export
  const currentFilters = table.getState().columnFilters;
  const statusFilter = currentFilters.find((f) => f.id === 'status');
  const queryParams: Record<string, string> = {};
  if (statusFilter && statusFilter.value) {
    if (Array.isArray(statusFilter.value)) {
      // For multi-select, use the first value or join them
      queryParams.status = Array.isArray(statusFilter.value)
        ? statusFilter.value[0]
        : String(statusFilter.value);
    } else {
      queryParams.status = String(statusFilter.value);
    }
  }

  return (
    <div className='h-[calc(100vh-250px)] min-h-[400px] w-full'>
      <DataTable table={table} onRowClick={handleRowClick}>
        <DataTableToolbar table={table}>
          <ExportButton
            exportType='invoices'
            queryParams={queryParams}
            showPdfExport={true}
          />
        </DataTableToolbar>
      </DataTable>
    </div>
  );
}

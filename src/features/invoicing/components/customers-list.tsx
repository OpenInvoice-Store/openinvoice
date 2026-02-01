'use client';

import { useState } from 'react';
import { useCustomers, type Customer } from '../hooks/use-customers';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { customerColumns } from './customer-tables/customer-columns';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { ExportButton } from '@/components/export-button';
import { ImportButton } from '@/components/import-button';

export function CustomersList() {
  const router = useRouter();
  const { data: customers = [], isLoading, error } = useCustomers();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: customers,
    columns: customerColumns,
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
        Error loading customers:{' '}
        {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const handleRowClick = (customer: Customer) => {
    router.push(`/dashboard/customers/${customer.id}`);
  };

  return (
    <div className='h-[calc(100vh-250px)] min-h-[400px] w-full'>
      <DataTable table={table} onRowClick={handleRowClick}>
        <DataTableToolbar table={table}>
          <div className='flex gap-2'>
            <ImportButton type='customers' />
            <ExportButton exportType='customers' />
          </div>
        </DataTableToolbar>
      </DataTable>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useProducts, type Product } from '../hooks/use-products';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { productColumns } from './product-tables/product-columns';
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

export function ProductsList() {
  const router = useRouter();
  const { data: products = [], isLoading, error } = useProducts();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: products,
    columns: productColumns,
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
        Error loading products:{' '}
        {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const handleRowClick = (product: Product) => {
    router.push(`/dashboard/products/${product.id}/edit`);
  };

  return (
    <div className='h-[calc(100vh-250px)] min-h-[400px] w-full'>
      <DataTable table={table} onRowClick={handleRowClick}>
        <DataTableToolbar table={table}>
          <div className='flex gap-2'>
            <ImportButton type='products' />
            <ExportButton exportType='products' />
          </div>
        </DataTableToolbar>
      </DataTable>
    </div>
  );
}

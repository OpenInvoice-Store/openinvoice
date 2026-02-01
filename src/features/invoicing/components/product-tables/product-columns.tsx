'use client';

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Package, DollarSign, FileText, Hash } from 'lucide-react';
import { Product } from '@/features/invoicing/hooks/use-products';
import { formatCurrency } from '@/lib/format';
import { CellAction } from './cell-action';
import { TruncatedText } from '@/components/ui/truncated-text';

export const productColumns: ColumnDef<Product>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ cell }) => {
      const name = cell.getValue<Product['name']>();
      return <div className='font-medium'>{name}</div>;
    },
    meta: {
      label: 'Name',
      placeholder: 'Search products...',
      variant: 'text',
      icon: Package
    },
    enableColumnFilter: true
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='Description' />
    ),
    cell: ({ cell }) => {
      const description = cell.getValue<Product['description']>();
      return description ? (
        <TruncatedText text={description} maxLength={50} />
      ) : (
        <span className='text-muted-foreground'>-</span>
      );
    },
    meta: {
      label: 'Description',
      placeholder: 'Search descriptions...',
      variant: 'text',
      icon: FileText
    },
    enableColumnFilter: true
  },
  {
    id: 'price',
    accessorKey: 'price',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='Price' />
    ),
    cell: ({ cell }) => {
      const price = cell.getValue<Product['price']>();
      return <div className='font-medium'>{formatCurrency(price)}</div>;
    },
    meta: {
      label: 'Price',
      variant: 'number',
      icon: DollarSign
    },
    enableColumnFilter: true
  },
  {
    id: 'taxRate',
    accessorKey: 'taxRate',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='Tax Rate' />
    ),
    cell: ({ cell }) => {
      const taxRate = cell.getValue<Product['taxRate']>();
      return <div>{taxRate}%</div>;
    },
    meta: {
      label: 'Tax Rate',
      variant: 'number',
      icon: Hash
    },
    enableColumnFilter: true
  },
  {
    id: 'unit',
    accessorKey: 'unit',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='Unit' />
    ),
    cell: ({ cell }) => {
      const unit = cell.getValue<Product['unit']>();
      return <div>{unit}</div>;
    },
    meta: {
      label: 'Unit',
      placeholder: 'Search units...',
      variant: 'text',
      icon: Package
    },
    enableColumnFilter: true
  },
  {
    id: 'actions',
    header: () => <div className='text-right'>Actions</div>,
    cell: ({ row }) => {
      return (
        <div className='flex justify-end'>
          <CellAction data={row.original} />
        </div>
      );
    }
  }
];

'use client';

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { User, Mail, Phone, MapPin } from 'lucide-react';
import { Customer } from '@/features/invoicing/hooks/use-customers';
import { CellAction } from './cell-action';
import { TruncatedText } from '@/components/ui/truncated-text';

export const customerColumns: ColumnDef<Customer>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ cell }) => {
      const name = cell.getValue<Customer['name']>();
      return <div className='font-medium'>{name}</div>;
    },
    meta: {
      label: 'Name',
      placeholder: 'Search customers...',
      variant: 'text',
      icon: User
    },
    enableColumnFilter: true
  },
  {
    id: 'email',
    accessorKey: 'email',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ cell }) => {
      const email = cell.getValue<Customer['email']>();
      return email ? (
        <TruncatedText text={email} maxLength={30} />
      ) : (
        <span className='text-muted-foreground'>-</span>
      );
    },
    meta: {
      label: 'Email',
      placeholder: 'Search emails...',
      variant: 'text',
      icon: Mail
    },
    enableColumnFilter: true
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='Phone' />
    ),
    cell: ({ cell }) => {
      const phone = cell.getValue<Customer['phone']>();
      return phone ? (
        <span>{phone}</span>
      ) : (
        <span className='text-muted-foreground'>-</span>
      );
    },
    meta: {
      label: 'Phone',
      placeholder: 'Search phones...',
      variant: 'text',
      icon: Phone
    },
    enableColumnFilter: true
  },
  {
    id: 'address',
    accessorKey: 'address',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='Address' />
    ),
    cell: ({ cell }) => {
      const address = cell.getValue<Customer['address']>();
      return address ? (
        <TruncatedText text={address} maxLength={40} />
      ) : (
        <span className='text-muted-foreground'>-</span>
      );
    },
    meta: {
      label: 'Address',
      placeholder: 'Search addresses...',
      variant: 'text',
      icon: MapPin
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

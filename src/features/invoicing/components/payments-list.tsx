'use client';

import { usePayments, useDeletePayment } from '../hooks/use-payments';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { IconTrash } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDate, formatCurrency } from '@/lib/format';
import { useState } from 'react';

export function PaymentsList({ invoiceId }: { invoiceId: string }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: payments, isLoading } = usePayments(invoiceId);
  const deletePayment = useDeletePayment();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePayment.mutateAsync(deleteId);
      toast.success('Payment deleted successfully');
      setDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete payment');
    }
  };

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!payments || payments.length === 0) {
    return <p className='text-sm text-muted-foreground'>No payments recorded</p>;
  }

  return (
    <>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{formatDate(payment.date)}</TableCell>
                <TableCell className='font-medium'>{formatCurrency(payment.amount)}</TableCell>
                <TableCell>{payment.method}</TableCell>
                <TableCell>{payment.notes || '-'}</TableCell>
                <TableCell className='text-right'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setDeleteId(payment.id)}
                  >
                    <IconTrash className='h-4 w-4 text-destructive' />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


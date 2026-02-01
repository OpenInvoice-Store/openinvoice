'use client';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Invoice,
  useDeleteInvoice
} from '@/features/invoicing/hooks/use-invoices';
import {
  IconEdit,
  IconDotsVertical,
  IconTrash,
  IconEye,
  IconLink
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface CellActionProps {
  data: Invoice;
}

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const router = useRouter();
  const deleteInvoice = useDeleteInvoice();

  const onConfirm = async () => {
    try {
      setLoading(true);
      await deleteInvoice.mutateAsync(data.id);
      toast.success('Invoice deleted successfully');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to delete invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = async () => {
    try {
      setIsGeneratingLink(true);
      const response = await fetch(`/api/invoices/${data.id}/share`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const { shareUrl } = await response.json();
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Shareable link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to generate share link');
      console.error('Error generating share link:', error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        loading={loading}
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0' data-no-row-click>
            <span className='sr-only'>Open menu</span>
            <IconDotsVertical className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/invoices/${data.id}`)}
          >
            <IconEye className='mr-2 h-4 w-4' /> View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleShareLink}
            disabled={isGeneratingLink}
          >
            <IconLink className='mr-2 h-4 w-4' />
            {isGeneratingLink ? 'Generating...' : 'Share Link'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/invoices/${data.id}/edit`)}
          >
            <IconEdit className='mr-2 h-4 w-4' /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <IconTrash className='mr-2 h-4 w-4' /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

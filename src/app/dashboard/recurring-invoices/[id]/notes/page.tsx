'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  useRecurringInvoice,
  useUpdateRecurringInvoice
} from '@/features/invoicing/hooks/use-recurring-invoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { IconEdit, IconCheck, IconX } from '@tabler/icons-react';

export default function RecurringInvoiceNotesPage() {
  const params = useParams();
  const id = params?.id as string;
  const templateQuery = useRecurringInvoice(id);
  const { data: template, isLoading } = templateQuery;
  const updateTemplate = useUpdateRecurringInvoice();
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState('');

  if (isLoading) {
    return <div className='text-muted-foreground p-4 text-sm'>Loading...</div>;
  }

  if (!template) {
    return (
      <div className='text-muted-foreground p-4 text-sm'>
        Template not found
      </div>
    );
  }

  const handleEdit = () => {
    setNotes(template.templateNotes || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setNotes('');
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        templateNotes: notes
      });
      toast.success('Notes updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update notes'
      );
    }
  };

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>Notes</CardTitle>
            {!isEditing && (
              <Button variant='outline' size='sm' onClick={handleEdit}>
                <IconEdit className='mr-2 h-4 w-4' />
                {template.templateNotes ? 'Edit' : 'Add'} Notes
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className='space-y-4'>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='Add notes for this template...'
                className='min-h-[200px] text-sm'
              />
              <div className='flex justify-end gap-2'>
                <Button variant='outline' size='sm' onClick={handleCancel}>
                  <IconX className='mr-2 h-4 w-4' />
                  Cancel
                </Button>
                <Button
                  size='sm'
                  onClick={handleSave}
                  disabled={updateTemplate.isPending}
                >
                  <IconCheck className='mr-2 h-4 w-4' />
                  {updateTemplate.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : template.templateNotes ? (
            <div className='space-y-2'>
              <p className='text-sm whitespace-pre-wrap'>
                {template.templateNotes}
              </p>
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              No notes have been added for this template yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

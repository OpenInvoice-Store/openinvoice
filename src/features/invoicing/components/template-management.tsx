'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IconPlus, IconEdit, IconTrash, IconCheck } from '@tabler/icons-react';
import { TemplateFormDialog } from './template-form-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  useInvoiceTemplates,
  useDeleteInvoiceTemplate,
  useSetDefaultTemplate,
  type InvoiceTemplate
} from '../hooks/use-templates';

export function TemplateManagement() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<InvoiceTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] =
    useState<InvoiceTemplate | null>(null);

  const { data: templates = [], isLoading } = useInvoiceTemplates();
  const deleteTemplate = useDeleteInvoiceTemplate();
  const setDefaultTemplate = useSetDefaultTemplate();

  const handleCreate = () => {
    setEditingTemplate(null);
    setIsFormOpen(true);
  };

  const handleEdit = (template: InvoiceTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleDelete = (template: InvoiceTemplate) => {
    setDeletingTemplate(template);
  };

  const confirmDelete = () => {
    if (deletingTemplate) {
      deleteTemplate.mutate(deletingTemplate.id, {
        onSuccess: () => {
          setDeletingTemplate(null);
        }
      });
    }
  };

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Invoice Templates</CardTitle>
              <CardDescription>
                Create and manage custom invoice templates for your organization
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <IconPlus className='mr-2 h-4 w-4' />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className='py-8 text-center'>
              <p className='text-muted-foreground mb-4'>
                No templates found. Create your first template to get started.
              </p>
              <Button onClick={handleCreate}>
                <IconPlus className='mr-2 h-4 w-4' />
                Create Template
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Layout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className='font-medium'>
                      {template.name}
                    </TableCell>
                    <TableCell>{template.layout || 'standard'}</TableCell>
                    <TableCell>
                      {template.isActive ? (
                        <Badge className='bg-green-500'>Active</Badge>
                      ) : (
                        <Badge variant='outline'>Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {template.isDefault ? (
                        <Badge className='bg-blue-500'>
                          <IconCheck className='mr-1 h-3 w-3' />
                          Default
                        </Badge>
                      ) : (
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => setDefaultTemplate.mutate(template.id)}
                          disabled={setDefaultTemplate.isPending}
                        >
                          Set as Default
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleEdit(template)}
                        >
                          <IconEdit className='h-4 w-4' />
                        </Button>
                        {!template.isDefault && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleDelete(template)}
                          >
                            <IconTrash className='h-4 w-4 text-red-500' />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Template Form Dialog */}
      <TemplateFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        template={editingTemplate}
        onSuccess={() => {
          setIsFormOpen(false);
          setEditingTemplate(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingTemplate}
        onOpenChange={(open) => !open && setDeletingTemplate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeletingTemplate(null)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={confirmDelete}
              disabled={deleteTemplate.isPending}
            >
              {deleteTemplate.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

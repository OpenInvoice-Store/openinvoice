'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImportDialog } from './import-dialog';
import { IconUpload } from '@tabler/icons-react';
import {
  useImportProducts,
  useImportCustomers
} from '@/features/invoicing/hooks/use-import';

interface ImportButtonProps {
  type: 'products' | 'customers';
  variant?:
    | 'default'
    | 'outline'
    | 'ghost'
    | 'link'
    | 'destructive'
    | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ImportButton({
  type,
  variant = 'outline',
  size = 'sm'
}: ImportButtonProps) {
  const [open, setOpen] = useState(false);
  const importProducts = useImportProducts();
  const importCustomers = useImportCustomers();

  const handleImport = async (file: File) => {
    if (type === 'products') {
      return await importProducts.mutateAsync(file);
    } else {
      return await importCustomers.mutateAsync(file);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <IconUpload className='mr-2 h-4 w-4' />
        Import
      </Button>
      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        onImport={handleImport}
        type={type}
      />
    </>
  );
}

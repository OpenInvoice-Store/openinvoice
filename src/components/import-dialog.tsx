'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { FileUploader } from '@/components/file-uploader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconDownload, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useDownloadTemplate } from '@/features/invoicing/hooks/use-import';
import { cn } from '@/lib/utils';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<any>;
  type: 'products' | 'customers';
  title?: string;
  description?: string;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
  type,
  title,
  description
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const downloadTemplate = useDownloadTemplate();

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const result = await onImport(file);
      setImportResult(result);

      // Check if there are validation errors
      if (result.errors && result.errors.length > 0) {
        setImportError(result.error || 'Validation errors found');
      }

      if (result.success) {
        // Close dialog after a short delay to show success message
        setTimeout(() => {
          onOpenChange(false);
          setFile(null);
          setImportResult(null);
          setImportError(null);
        }, 2000);
      }
    } catch (error: any) {
      // Try to extract error details from response
      if (error.message) {
        setImportError(error.message);
      } else {
        setImportError(
          'Failed to import file. Please check the file format and try again.'
        );
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadTemplate.mutate(type);
  };

  const handleClose = () => {
    if (!isImporting) {
      onOpenChange(false);
      setFile(null);
      setImportResult(null);
      setImportError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {title || `Import ${type.charAt(0).toUpperCase() + type.slice(1)}`}
          </DialogTitle>
          <DialogDescription>
            {description ||
              `Upload a CSV or Excel file to import ${type}. Download the template to see the required format.`}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Template Download */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <p className='text-sm font-medium'>Need a template?</p>
              <p className='text-muted-foreground text-xs'>
                Download the Excel template with example data
              </p>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={handleDownloadTemplate}
              disabled={downloadTemplate.isPending}
            >
              <IconDownload className='mr-2 h-4 w-4' />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <FileUploader
            value={file ? [file] : []}
            onValueChange={(value) => {
              const files =
                typeof value === 'function' ? value(file ? [file] : []) : value;
              if (files && files.length > 0) {
                setFile(files[0]);
              } else {
                setFile(null);
              }
              setImportResult(null);
              setImportError(null);
            }}
            accept={{
              'text/csv': ['.csv'],
              'application/vnd.ms-excel': ['.xls'],
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                ['.xlsx']
            }}
            maxSize={10 * 1024 * 1024} // 10MB
            maxFiles={1}
            disabled={isImporting}
          />

          {/* Validation Errors */}
          {importError && (
            <Alert variant='destructive'>
              <IconAlertCircle className='h-4 w-4' />
              <AlertDescription>
                <div className='space-y-2'>
                  <p className='font-medium'>{importError}</p>
                  {importResult?.errors && importResult.errors.length > 0 && (
                    <div className='mt-2'>
                      <p className='mb-2 text-sm font-medium'>
                        Validation errors ({importResult.errorCount}):
                      </p>
                      <ScrollArea className='max-h-48 rounded-md border p-2'>
                        <div className='space-y-1'>
                          {importResult.errors.map(
                            (error: any, index: number) => (
                              <div key={index} className='text-xs'>
                                <span className='font-medium'>
                                  Row {error.row}:
                                </span>{' '}
                                <span className='text-muted-foreground'>
                                  {error.field} - {error.message}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {importResult?.success && (
            <Alert className='border-green-500 bg-green-50 dark:bg-green-950'>
              <IconCheck className='h-4 w-4 text-green-600' />
              <AlertDescription className='text-green-800 dark:text-green-200'>
                <p className='font-medium'>{importResult.message}</p>
                {importResult.count !== undefined && (
                  <p className='mt-1 text-sm'>
                    Successfully imported {importResult.count} {type}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Partial Success */}
          {importResult?.validCount !== undefined &&
            importResult?.errorCount !== undefined &&
            importResult.validCount > 0 &&
            importResult.errorCount > 0 && (
              <Alert>
                <IconAlertCircle className='h-4 w-4' />
                <AlertDescription>
                  <p className='font-medium'>
                    Partial import: {importResult.validCount} {type} imported
                    successfully, {importResult.errorCount} errors found
                  </p>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    Please fix the errors and try importing again
                  </p>
                </AlertDescription>
              </Alert>
            )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={handleClose}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isImporting}>
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

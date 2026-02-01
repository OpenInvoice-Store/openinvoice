'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  IconDownload,
  IconFile,
  IconFileSpreadsheet,
  IconFileText
} from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface ExportButtonProps {
  exportType: 'invoices' | 'customers' | 'products' | 'payments';
  filename?: string;
  queryParams?: Record<string, string>;
  disabled?: boolean;
  showPdfExport?: boolean; // Show PDF export option for invoices
  selectedIds?: string[]; // Selected invoice IDs for bulk PDF export
}

export function ExportButton({
  exportType,
  filename,
  queryParams = {},
  disabled = false,
  showPdfExport = false,
  selectedIds = []
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setIsExporting(true);
    try {
      let url: string;
      let options: RequestInit = {};

      if (format === 'pdf' && exportType === 'invoices') {
        // PDF export for invoices (bulk)
        url = '/api/export/invoices/pdf';

        if (selectedIds.length > 0) {
          // POST with selected IDs
          options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceIds: selectedIds })
          };
        } else {
          // GET with query params
          const params = new URLSearchParams(queryParams);
          url = `${url}?${params.toString()}`;
        }
      } else {
        // CSV/Excel export
        const params = new URLSearchParams({
          format,
          ...queryParams
        });
        url = `/api/export/${exportType}?${params.toString()}`;
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const contentDisposition = response.headers.get('Content-Disposition');
      let downloadFilename =
        filename || `${exportType}-${new Date().toISOString().split('T')[0]}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          downloadFilename = filenameMatch[1];
        }
      } else {
        if (format === 'pdf') {
          downloadFilename += '.zip';
        } else {
          downloadFilename += format === 'xlsx' ? '.xlsx' : '.csv';
        }
      }

      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(
        format === 'pdf'
          ? `Exported ${selectedIds.length || 'all'} invoices as PDF`
          : `Exported ${exportType} as ${format.toUpperCase()}`
      );
    } catch (error) {
      console.error('Export error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to export ${exportType}`
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='sm' disabled={disabled || isExporting}>
          <IconDownload className='mr-2 h-4 w-4' />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem
          onClick={() => handleExport('csv')}
          disabled={isExporting}
        >
          <IconFile className='mr-2 h-4 w-4' />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('xlsx')}
          disabled={isExporting}
        >
          <IconFileSpreadsheet className='mr-2 h-4 w-4' />
          Export as Excel
        </DropdownMenuItem>
        {showPdfExport && exportType === 'invoices' && (
          <DropdownMenuItem
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
          >
            <IconFileText className='mr-2 h-4 w-4' />
            Export as PDF (ZIP)
            {selectedIds.length > 0 && (
              <span className='text-muted-foreground ml-2 text-xs'>
                ({selectedIds.length} selected)
              </span>
            )}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

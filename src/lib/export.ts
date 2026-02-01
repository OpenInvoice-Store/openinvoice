import * as XLSX from 'xlsx';

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers?: Record<string, string>
): void {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Map headers if provided
  const mappedData = headers
    ? data.map((row) => {
        const mapped: Record<string, any> = {};
        Object.keys(headers).forEach((key) => {
          mapped[headers[key]] = row[key];
        });
        return mapped;
      })
    : data;

  // Convert to CSV
  const headersList = Object.keys(mappedData[0]);
  const csvContent = [
    headersList.join(','),
    ...mappedData.map((row) =>
      headersList
        .map((header) => {
          const value = row[header];
          // Handle values that contain commas, quotes, or newlines
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (
            stringValue.includes(',') ||
            stringValue.includes('"') ||
            stringValue.includes('\n')
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to Excel format
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  sheetName: string = 'Sheet1',
  headers?: Record<string, string>
): void {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Map headers if provided
  const mappedData = headers
    ? data.map((row) => {
        const mapped: Record<string, any> = {};
        Object.keys(headers).forEach((key) => {
          mapped[headers[key]] = row[key];
        });
        return mapped;
      })
    : data;

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(mappedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate Excel file and download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Format invoice data for export
 */
export function formatInvoiceForExport(invoice: any) {
  const subtotal = invoice.items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );
  const tax = invoice.items.reduce(
    (sum: number, item: any) =>
      sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  const total = subtotal + tax;
  const totalPaid = invoice.payments.reduce(
    (sum: number, p: any) => sum + p.amount,
    0
  );
  const balance = total - totalPaid;

  return {
    'Invoice #': invoice.invoiceNo,
    'Customer Name': invoice.customer?.name || '',
    'Customer Email': invoice.customer?.email || '',
    'Issue Date': new Date(invoice.issueDate).toLocaleDateString(),
    'Due Date': new Date(invoice.dueDate).toLocaleDateString(),
    Status: invoice.status,
    Subtotal: subtotal.toFixed(2),
    Tax: tax.toFixed(2),
    Total: total.toFixed(2),
    'Total Paid': totalPaid.toFixed(2),
    Balance: balance.toFixed(2),
    'Item Count': invoice.items.length,
    'Payment Count': invoice.payments.length,
    Notes: invoice.notes || '',
    'Created At': new Date(invoice.createdAt).toLocaleString(),
    'Updated At': new Date(invoice.updatedAt).toLocaleString()
  };
}

/**
 * Format customer data for export
 */
export function formatCustomerForExport(customer: any) {
  const totalInvoices = customer.invoices?.length || 0;
  const totalRevenue = (customer.invoices || []).reduce(
    (sum: number, inv: any) => {
      const subtotal = inv.items.reduce(
        (s: number, item: any) => s + item.price * item.quantity,
        0
      );
      const tax = inv.items.reduce(
        (s: number, item: any) =>
          s + item.price * item.quantity * (item.taxRate / 100),
        0
      );
      return sum + subtotal + tax;
    },
    0
  );

  return {
    'Customer Name': customer.name,
    Email: customer.email || '',
    Phone: customer.phone || '',
    Address: customer.address || '',
    'Total Invoices': totalInvoices,
    'Total Revenue': totalRevenue.toFixed(2),
    'Created At': new Date(customer.createdAt).toLocaleString(),
    'Updated At': new Date(customer.updatedAt).toLocaleString()
  };
}

/**
 * Format product data for export
 */
export function formatProductForExport(product: any) {
  return {
    'Product Name': product.name,
    Description: product.description || '',
    Price: product.price.toFixed(2),
    'Tax Rate (%)': product.taxRate.toFixed(2),
    'Created At': new Date(product.createdAt).toLocaleString(),
    'Updated At': new Date(product.updatedAt).toLocaleString()
  };
}

/**
 * Format payment data for export
 */
export function formatPaymentForExport(payment: any) {
  return {
    'Payment ID': payment.id,
    'Invoice #': payment.invoice?.invoiceNo || '',
    'Customer Name': payment.invoice?.customer?.name || '',
    Amount: payment.amount.toFixed(2),
    Method: payment.method,
    Date: new Date(payment.date).toLocaleString(),
    Notes: payment.notes || '',
    'Stripe Payment Intent': payment.stripePaymentIntentId || '',
    'Created At': new Date(payment.createdAt).toLocaleString()
  };
}

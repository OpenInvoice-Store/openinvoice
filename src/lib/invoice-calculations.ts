import type { Invoice } from '@/features/invoicing/hooks/use-invoices';

export interface InvoiceTotals {
  subtotal: number;
  manualTax: number;
  customTax: number;
  totalTax: number;
  total: number;
  totalPaid: number;
  balance: number;
}

/**
 * Calculate invoice totals (subtotal, tax, total, balance)
 * Handles both legacy manual tax (from item.taxRate) and new custom tax system
 */
export function calculateInvoiceTotals(invoice: Invoice): InvoiceTotals {
  // Calculate subtotal
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Legacy manual tax calculation (from item.taxRate)
  const manualTax = invoice.items.reduce(
    (sum, item) =>
      sum + item.price * item.quantity * ((item.taxRate || 0) / 100),
    0
  );

  // Get custom tax from invoice taxes (new system)
  const invoiceTaxesRaw = (invoice as any)?.invoiceTaxes;
  let invoiceTaxes: any[] = [];

  if (Array.isArray(invoiceTaxesRaw)) {
    invoiceTaxes = invoiceTaxesRaw;
  } else if (invoiceTaxesRaw && typeof invoiceTaxesRaw === 'object') {
    invoiceTaxes = [invoiceTaxesRaw];
  }

  const customTax = invoiceTaxes.reduce((sum: number, tax: any) => {
    if (!tax || typeof tax !== 'object') return sum;
    const amount = parseFloat(tax.amount) || 0;
    return sum + amount;
  }, 0);

  const totalTax = manualTax + customTax;
  const total = subtotal + totalTax;
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = total - totalPaid;

  return {
    subtotal,
    manualTax,
    customTax,
    totalTax,
    total,
    totalPaid,
    balance
  };
}

/**
 * Calculate totals from an array of items (for templates or forms)
 * This is a simpler version that only handles manual tax from item.taxRate
 */
export interface ItemTotals {
  subtotal: number;
  tax: number;
  total: number;
}

export function calculateItemTotals(
  items: Array<{ price: number; quantity: number; taxRate?: number }>
): ItemTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = items.reduce(
    (sum, item) =>
      sum + item.price * item.quantity * ((item.taxRate || 0) / 100),
    0
  );
  return {
    subtotal,
    tax,
    total: subtotal + tax
  };
}

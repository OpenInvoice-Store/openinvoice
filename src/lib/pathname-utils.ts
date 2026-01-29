/**
 * Extract the current section from an invoice detail pathname
 * @param pathname - Full pathname (e.g., '/dashboard/invoices/123/details')
 * @param invoiceId - The invoice ID to compare against
 * @param validSections - Array of valid section names
 * @returns The current section name, defaults to 'details' if not found
 */
export function getInvoiceSectionFromPathname(
  pathname: string | null,
  invoiceId: string,
  validSections: string[]
): string {
  if (!pathname) return 'details';

  const pathParts = pathname.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  // If last part is the invoice id or not a valid section, default to 'details'
  if (lastPart === invoiceId || !validSections.includes(lastPart)) {
    return 'details';
  }

  return lastPart;
}

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrencyAmount, getInvoiceCurrency } from '@/lib/currency';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica'
  },
  header: {
    marginBottom: 24
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 12,
    color: '#555'
  },
  section: {
    marginBottom: 18
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4
  },
  label: {
    width: 130,
    fontWeight: 'bold'
  },
  value: {
    flex: 1
  },
  amountRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1pt solid #e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  amountLabel: {
    fontWeight: 'bold'
  },
  amountValue: {
    fontWeight: 'bold',
    fontSize: 14
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTop: '1pt solid #e0e0e0',
    fontSize: 10,
    color: '#666'
  }
});

interface PaymentReceiptPDFProps {
  payment: any;
  invoice: any;
  organizationName?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
}

export function PaymentReceiptPDF({
  payment,
  invoice,
  organizationName,
  cardBrand,
  cardLast4
}: PaymentReceiptPDFProps) {
  const paymentDate = new Date(payment.date).toLocaleDateString();
  const issueDate = new Date(invoice.issueDate).toLocaleDateString();

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
  const previousPaid = totalPaid - payment.amount;
  const remainingBalance = total - totalPaid;

  const currency = getInvoiceCurrency(
    invoice,
    invoice.organization?.defaultCurrency
  );
  const formatMoney = (value: number) => formatCurrencyAmount(value, currency);

  return (
    <Document>
      <Page size='A4' style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>PAYMENT RECEIPT</Text>
          <Text style={styles.subtitle}>
            {organizationName || 'Open Invoice'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipt Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Receipt ID:</Text>
            <Text style={styles.value}>{payment.id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Date:</Text>
            <Text style={styles.value}>{paymentDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Method:</Text>
            <Text style={styles.value}>
              {payment.method}
              {cardBrand && cardLast4
                ? ` • ${cardBrand.toUpperCase()} •••• ${cardLast4}`
                : ''}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice Number:</Text>
            <Text style={styles.value}>#{invoice.invoiceNo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice Issue Date:</Text>
            <Text style={styles.value}>{issueDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice Status:</Text>
            <Text style={styles.value}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billed To</Text>
          <Text>{invoice.customer?.name}</Text>
          {invoice.customer?.email && <Text>{invoice.customer.email}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Invoice Total:</Text>
            <Text style={styles.value}>{formatMoney(total)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Previously Paid:</Text>
            <Text style={styles.value}>{formatMoney(previousPaid)}</Text>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>This Payment:</Text>
            <Text style={styles.amountValue}>
              {formatMoney(payment.amount)}
            </Text>
          </View>

          <View style={[styles.amountRow, { borderTop: 'none', marginTop: 4 }]}>
            <Text style={styles.amountLabel}>Total Paid To Date:</Text>
            <Text style={styles.amountValue}>{formatMoney(totalPaid)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Remaining Balance:</Text>
            <Text style={styles.value}>{formatMoney(remainingBalance)}</Text>
          </View>
        </View>

        {payment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{payment.notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>
            This receipt acknowledges payment received for the above invoice.
          </Text>
          <Text>
            If you have any questions about this receipt, please contact the
            issuer of the invoice.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

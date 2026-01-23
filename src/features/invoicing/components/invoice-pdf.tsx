import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register fonts if needed
// Font.register({
//   family: 'Roboto',
//   src: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxP.ttf',
// });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  invoiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 100,
    fontWeight: 'bold',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1pt solid #e0e0e0',
  },
  colDescription: {
    width: '40%',
  },
  colQuantity: {
    width: '15%',
    textAlign: 'right',
  },
  colPrice: {
    width: '15%',
    textAlign: 'right',
  },
  colTax: {
    width: '15%',
    textAlign: 'right',
  },
  colTotal: {
    width: '15%',
    textAlign: 'right',
  },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    width: 200,
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  grandTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    borderTop: '1pt solid #000',
    paddingTop: 5,
    marginTop: 5,
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1pt solid #e0e0e0',
    fontSize: 10,
    color: '#666',
  },
});

interface InvoicePDFProps {
  invoice: any;
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  return (
    <Document>
      <Page size='A4' style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>INVOICE</Text>
          <Text>Invoice #{invoice.invoiceNo}</Text>
        </View>

        <View style={styles.invoiceInfo}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill To:</Text>
            <Text>{invoice.customer?.name}</Text>
            {invoice.customer?.email && <Text>{invoice.customer.email}</Text>}
            {invoice.customer?.address && <Text>{invoice.customer.address}</Text>}
          </View>

          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>Issue Date:</Text>
              <Text>{new Date(invoice.issueDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Due Date:</Text>
              <Text>{new Date(invoice.dueDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <Text>{invoice.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colDescription}>Description</Text>
              <Text style={styles.colQuantity}>Qty</Text>
              <Text style={styles.colPrice}>Price</Text>
              <Text style={styles.colTax}>Tax %</Text>
              <Text style={styles.colTotal}>Total</Text>
            </View>
            {invoice.items.map((item: any) => {
              const itemSubtotal = item.price * item.quantity;
              const itemTax = itemSubtotal * (item.taxRate / 100);
              const itemTotal = itemSubtotal + itemTax;
              return (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={styles.colDescription}>{item.description}</Text>
                  <Text style={styles.colQuantity}>{item.quantity}</Text>
                  <Text style={styles.colPrice}>${item.price.toFixed(2)}</Text>
                  <Text style={styles.colTax}>{item.taxRate}%</Text>
                  <Text style={styles.colTotal}>${itemTotal.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>${invoice.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Tax:</Text>
            <Text>${invoice.tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text>Total:</Text>
            <Text>${invoice.total.toFixed(2)}</Text>
          </View>
          {invoice.totalPaid > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text>Paid:</Text>
                <Text>${invoice.totalPaid.toFixed(2)}</Text>
              </View>
              <View style={[styles.totalRow, { fontWeight: 'bold' }]}>
                <Text>Balance:</Text>
                <Text>${invoice.balance.toFixed(2)}</Text>
              </View>
            </>
          )}
        </View>

        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {invoice.payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payments</Text>
            {invoice.payments.map((payment: any) => (
              <View key={payment.id} style={styles.row}>
                <Text>
                  {new Date(payment.date).toLocaleDateString()} - ${payment.amount.toFixed(2)} ({payment.method})
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
}


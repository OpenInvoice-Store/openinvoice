import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image
} from '@react-pdf/renderer';
import { formatCurrencyAmount, getInvoiceCurrency } from '@/lib/currency';

// Register fonts if needed
// Font.register({
//   family: 'Roboto',
//   src: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxP.ttf',
// });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica'
  },
  header: {
    marginBottom: 30
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10
  },
  invoiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5
  },
  label: {
    width: 100,
    fontWeight: 'bold'
  },
  table: {
    marginTop: 10
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontWeight: 'bold'
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1pt solid #e0e0e0'
  },
  colDescription: {
    width: '40%'
  },
  colQuantity: {
    width: '15%',
    textAlign: 'right'
  },
  colPrice: {
    width: '15%',
    textAlign: 'right'
  },
  colTax: {
    width: '15%',
    textAlign: 'right'
  },
  colTotal: {
    width: '15%',
    textAlign: 'right'
  },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end'
  },
  totalRow: {
    flexDirection: 'row',
    width: 200,
    justifyContent: 'space-between',
    marginBottom: 5
  },
  totalLabel: {
    fontWeight: 'bold'
  },
  grandTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    borderTop: '1pt solid #000',
    paddingTop: 5,
    marginTop: 5
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1pt solid #e0e0e0',
    fontSize: 10,
    color: '#666'
  }
});

interface InvoicePDFProps {
  invoice: any;
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const org = invoice.organization || {};
  const template = invoice.invoiceTemplate;
  const layout = template?.layout || 'standard';
  const primaryColor = org.primaryColor || '#2563eb';
  const secondaryColor = org.secondaryColor || '#64748b';
  const fontFamily = org.fontFamily || 'Helvetica';
  const footerText = org.footerText || 'Thank you for your business!';
  const currency = getInvoiceCurrency(invoice, org.defaultCurrency);

  // Adjust padding and font sizes based on layout
  const pagePadding =
    layout === 'compact' ? 30 : layout === 'detailed' ? 50 : 40;
  const baseFontSize =
    layout === 'compact' ? 10 : layout === 'detailed' ? 13 : 12;
  const titleFontSize =
    layout === 'compact' ? 18 : layout === 'detailed' ? 28 : 24;

  // Create dynamic styles with branding
  const dynamicStyles = StyleSheet.create({
    page: {
      padding: pagePadding,
      fontSize: baseFontSize,
      fontFamily: fontFamily
    },
    title: {
      fontSize: titleFontSize,
      fontWeight: 'bold',
      marginBottom: 10,
      color: primaryColor
    },
    companyInfo: {
      marginBottom: layout === 'compact' ? 15 : 20,
      fontSize: baseFontSize - 2,
      color: secondaryColor
    },
    footer: {
      marginTop: layout === 'compact' ? 30 : 40,
      paddingTop: layout === 'compact' ? 15 : 20,
      borderTop: '1pt solid #e0e0e0',
      fontSize: baseFontSize - 2,
      color: secondaryColor,
      textAlign: 'center'
    }
  });

  return (
    <Document>
      <Page size='A4' style={dynamicStyles.page}>
        <View style={styles.header}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 20
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                flex: 1,
                gap: 15
              }}
            >
              {org.logoUrl && (
                <View>
                  <Image
                    src={org.logoUrl}
                    style={{
                      maxHeight: 60,
                      maxWidth: 200,
                      objectFit: 'contain'
                    }}
                  />
                </View>
              )}
              {org.name && (
                <View style={[dynamicStyles.companyInfo, { flex: 1 }]}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: 'bold',
                      marginBottom: 4
                    }}
                  >
                    {org.name}
                  </Text>
                  {org.companyAddress && <Text>{org.companyAddress}</Text>}
                  {org.companyPhone && <Text>{org.companyPhone}</Text>}
                  {org.companyEmail && <Text>{org.companyEmail}</Text>}
                  {org.companyWebsite && <Text>{org.companyWebsite}</Text>}
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: primaryColor,
                  marginBottom: 5
                }}
              >
                Invoice #{invoice.invoiceNo}
              </Text>
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
        </View>

        {layout === 'detailed' ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 20
            }}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bill To:</Text>
              <Text>{invoice.customer?.name}</Text>
              {invoice.customer?.email && <Text>{invoice.customer.email}</Text>}
              {invoice.customer?.address && (
                <Text>{invoice.customer.address}</Text>
              )}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Invoice Details:</Text>
              <Text>Invoice #: {invoice.invoiceNo}</Text>
              <Text>
                Issue Date: {new Date(invoice.issueDate).toLocaleDateString()}
              </Text>
              <Text>
                Due Date: {new Date(invoice.dueDate).toLocaleDateString()}
              </Text>
              <Text>Status: {invoice.status.toUpperCase()}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.invoiceInfo}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bill To:</Text>
              <Text>{invoice.customer?.name}</Text>
              {invoice.customer?.email && <Text>{invoice.customer.email}</Text>}
              {invoice.customer?.address && (
                <Text>{invoice.customer.address}</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.colDescription}>Description</Text>
              <Text style={styles.colQuantity}>Qty</Text>
              <Text style={styles.colPrice}>Price</Text>
              {layout !== 'compact' && <Text style={styles.colTax}>Tax %</Text>}
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
                  <Text style={styles.colPrice}>
                    {formatCurrencyAmount(item.price, currency)}
                  </Text>
                  {layout !== 'compact' && (
                    <Text style={styles.colTax}>{item.taxRate}%</Text>
                  )}
                  <Text style={styles.colTotal}>
                    {formatCurrencyAmount(itemTotal, currency)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrencyAmount(invoice.subtotal, currency)}</Text>
          </View>
          {/* Manual Tax */}
          {invoice.manualTax > 0 && (
            <View style={styles.totalRow}>
              <Text>Manual Tax:</Text>
              <Text>{formatCurrencyAmount(invoice.manualTax, currency)}</Text>
            </View>
          )}
          {/* Custom Tax Breakdown */}
          {invoice.invoiceTaxes && invoice.invoiceTaxes.length > 0 && (
            <>
              {invoice.invoiceTaxes.map((tax: any, index: number) => (
                <View key={tax.id || index} style={styles.totalRow}>
                  <Text>
                    {tax.name} ({tax.rate}%):
                  </Text>
                  <Text>{formatCurrencyAmount(tax.amount, currency)}</Text>
                </View>
              ))}
            </>
          )}
          {/* Total Tax */}
          {invoice.tax > 0 && (
            <View
              style={[
                styles.totalRow,
                { borderTop: '1pt solid #e0e0e0', paddingTop: 5, marginTop: 5 }
              ]}
            >
              <Text style={{ fontWeight: 'bold' }}>Total Tax:</Text>
              <Text style={{ fontWeight: 'bold' }}>
                {formatCurrencyAmount(invoice.tax, currency)}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text>Total:</Text>
            <Text>{formatCurrencyAmount(invoice.total, currency)}</Text>
          </View>
          {invoice.totalPaid > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text>Paid:</Text>
                <Text>{formatCurrencyAmount(invoice.totalPaid, currency)}</Text>
              </View>
              <View style={[styles.totalRow, { fontWeight: 'bold' }]}>
                <Text>Balance:</Text>
                <Text>{formatCurrencyAmount(invoice.balance, currency)}</Text>
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
                  {new Date(payment.date).toLocaleDateString()} -{' '}
                  {formatCurrencyAmount(payment.amount, currency)} (
                  {payment.method})
                </Text>
              </View>
            ))}
          </View>
        )}

        {template?.footerTemplate ? (
          <View style={dynamicStyles.footer}>
            <Text>{template.footerTemplate.replace(/<[^>]*>/g, '')}</Text>
          </View>
        ) : (
          <View style={dynamicStyles.footer}>
            <Text>{footerText}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

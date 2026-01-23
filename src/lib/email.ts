import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set in environment variables');
}

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendInvoiceEmailParams {
  to: string;
  customerName: string;
  invoiceNo: number;
  invoiceUrl: string;
  pdfUrl: string;
  issueDate: Date | string;
  dueDate: Date | string;
  total: number;
  organizationName?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface SendPaymentConfirmationEmailParams {
  to: string;
  customerName: string;
  invoiceNo: number;
  invoiceUrl: string;
  amount: number;
  paymentDate: Date | string;
  organizationName?: string;
  fromEmail?: string;
  fromName?: string;
}

/**
 * Get the from email address
 * Defaults to 'onboarding@resend.dev' if not configured
 */
function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
}

/**
 * Get the from name
 */
function getFromName(): string {
  return process.env.RESEND_FROM_NAME || 'Open Invoice';
}

/**
 * Send an invoice email to a customer
 */
export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  const {
    to,
    customerName,
    invoiceNo,
    invoiceUrl,
    pdfUrl,
    issueDate,
    dueDate,
    total,
    organizationName
  } = params;

  const fromEmail = params.fromEmail || getFromEmail();
  const fromName = params.fromName || getFromName();

  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Invoice #${invoiceNo} from ${organizationName || 'Open Invoice'}`,
      html: generateInvoiceEmailHTML({
        customerName,
        invoiceNo,
        invoiceUrl,
        pdfUrl,
        issueDate,
        dueDate,
        total,
        organizationName
      })
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw error;
  }
}

/**
 * Send a payment confirmation email
 */
export async function sendPaymentConfirmationEmail(
  params: SendPaymentConfirmationEmailParams
) {
  const {
    to,
    customerName,
    invoiceNo,
    invoiceUrl,
    amount,
    paymentDate,
    organizationName
  } = params;

  const fromEmail = params.fromEmail || getFromEmail();
  const fromName = params.fromName || getFromName();

  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Payment Confirmation - Invoice #${invoiceNo}`,
      html: generatePaymentConfirmationEmailHTML({
        customerName,
        invoiceNo,
        invoiceUrl,
        amount,
        paymentDate,
        organizationName
      })
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    throw error;
  }
}

/**
 * Generate HTML email template for invoice
 */
function generateInvoiceEmailHTML(params: {
  customerName: string;
  invoiceNo: number;
  invoiceUrl: string;
  pdfUrl: string;
  issueDate: Date | string;
  dueDate: Date | string;
  total: number;
  organizationName?: string;
}): string {
  const {
    customerName,
    invoiceNo,
    invoiceUrl,
    pdfUrl,
    issueDate,
    dueDate,
    total,
    organizationName
  } = params;

  const formattedIssueDate = new Date(issueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(total);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${invoiceNo}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; margin-top: 0; font-size: 24px;">Invoice #${invoiceNo}</h1>
    
    <p style="color: #666; font-size: 16px;">Hello ${customerName},</p>
    
    <p style="color: #666; font-size: 16px;">
      ${organizationName ? `Thank you for your business with ${organizationName}. ` : ''}Please find your invoice details below:
    </p>
    
    <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Issue Date:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #333;">${formattedIssueDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Due Date:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #333;">${formattedDueDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Total Amount:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 18px; font-weight: bold;">${formattedTotal}</td>
        </tr>
      </table>
    </div>
    
    <div style="margin: 30px 0; text-align: center;">
      <a href="${invoiceUrl}" 
         style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 5px;">
        View Invoice Online
      </a>
      <a href="${pdfUrl}" 
         style="display: inline-block; background-color: #ffffff; color: #2563eb; border: 2px solid #2563eb; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 5px;">
        Download PDF
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      If you have any questions about this invoice, please don't hesitate to contact us.
    </p>
    
    <p style="color: #666; font-size: 14px; margin-top: 20px;">
      Best regards,<br>
      ${organizationName || 'Open Invoice Team'}
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML email template for payment confirmation
 */
function generatePaymentConfirmationEmailHTML(params: {
  customerName: string;
  invoiceNo: number;
  invoiceUrl: string;
  amount: number;
  paymentDate: Date | string;
  organizationName?: string;
}): string {
  const {
    customerName,
    invoiceNo,
    invoiceUrl,
    amount,
    paymentDate,
    organizationName
  } = params;

  const formattedPaymentDate = new Date(paymentDate).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  );

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmation - Invoice #${invoiceNo}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #059669; margin-top: 0; font-size: 24px;">✓ Payment Received</h1>
    
    <p style="color: #666; font-size: 16px;">Hello ${customerName},</p>
    
    <p style="color: #666; font-size: 16px;">
      This email confirms that we have received your payment for Invoice #${invoiceNo}.
    </p>
    
    <div style="background-color: #f0fdf4; border: 2px solid #059669; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Invoice Number:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #333;">#${invoiceNo}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Payment Date:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #333;">${formattedPaymentDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Amount Paid:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #059669; font-size: 18px; font-weight: bold;">${formattedAmount}</td>
        </tr>
      </table>
    </div>
    
    <div style="margin: 30px 0; text-align: center;">
      <a href="${invoiceUrl}" 
         style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        View Invoice
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      Thank you for your payment. We appreciate your business!
    </p>
    
    <p style="color: #666; font-size: 14px; margin-top: 20px;">
      Best regards,<br>
      ${organizationName || 'Open Invoice Team'}
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</body>
</html>
  `.trim();
}

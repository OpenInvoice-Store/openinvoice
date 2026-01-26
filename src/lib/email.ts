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
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    companyWebsite?: string | null;
    footerText?: string | null;
  };
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

export interface SendPaymentReminderEmailParams {
  to: string;
  customerName: string;
  invoiceNo: number;
  invoiceUrl: string;
  pdfUrl: string;
  issueDate: Date | string;
  dueDate: Date | string;
  total: number;
  daysUntilDue?: number;
  daysOverdue?: number;
  organizationName?: string;
  fromEmail?: string;
  fromName?: string;
  reminderType?: 'upcoming' | 'overdue' | 'final';
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
        organizationName,
        branding: params.branding
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
 * Send a payment reminder email
 */
export async function sendPaymentReminderEmail(
  params: SendPaymentReminderEmailParams
) {
  const {
    to,
    customerName,
    invoiceNo,
    invoiceUrl,
    pdfUrl,
    issueDate,
    dueDate,
    total,
    daysUntilDue,
    daysOverdue,
    organizationName,
    reminderType = daysOverdue ? 'overdue' : 'upcoming'
  } = params;

  const fromEmail = params.fromEmail || getFromEmail();
  const fromName = params.fromName || getFromName();

  // Determine subject based on reminder type
  let subject: string;
  if (reminderType === 'final') {
    subject = `Final Notice - Overdue Invoice #${invoiceNo}`;
  } else if (reminderType === 'overdue') {
    subject = `Payment Reminder - Overdue Invoice #${invoiceNo}`;
  } else {
    subject = `Payment Reminder - Invoice #${invoiceNo}`;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `${subject} from ${organizationName || 'Open Invoice'}`,
      html: generatePaymentReminderEmailHTML({
        customerName,
        invoiceNo,
        invoiceUrl,
        pdfUrl,
        issueDate,
        dueDate,
        total,
        daysUntilDue,
        daysOverdue,
        organizationName,
        reminderType
      })
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Error sending payment reminder email:', error);
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
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    companyWebsite?: string | null;
    footerText?: string | null;
  };
}): string {
  const {
    customerName,
    invoiceNo,
    invoiceUrl,
    pdfUrl,
    issueDate,
    dueDate,
    total,
    organizationName,
    branding
  } = params;

  const primaryColor = branding?.primaryColor || '#2563eb';
  const secondaryColor = branding?.secondaryColor || '#64748b';
  const footerText = branding?.footerText || 'Thank you for your business!';

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
    ${branding?.logoUrl ? `<div style="margin-bottom: 20px; text-align: center;"><img src="${branding.logoUrl}" alt="${organizationName || 'Company'}" style="max-height: 60px; max-width: 200px;" /></div>` : ''}
    <h1 style="color: ${primaryColor}; margin-top: 0; font-size: 24px;">Invoice #${invoiceNo}</h1>
    ${
      branding?.companyAddress ||
      branding?.companyPhone ||
      branding?.companyEmail ||
      branding?.companyWebsite
        ? `
    <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: ${secondaryColor};">
      ${branding.companyAddress ? `<div>${branding.companyAddress}</div>` : ''}
      ${branding.companyPhone || branding.companyEmail ? `<div>${branding.companyPhone || ''} ${branding.companyEmail ? `| ${branding.companyEmail}` : ''}</div>` : ''}
      ${branding.companyWebsite ? `<div><a href="${branding.companyWebsite}" style="color: ${primaryColor};">${branding.companyWebsite}</a></div>` : ''}
    </div>
    `
        : ''
    }
    
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
         style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 5px;">
        View Invoice Online
      </a>
      <a href="${pdfUrl}" 
         style="display: inline-block; background-color: #ffffff; color: ${primaryColor}; border: 2px solid ${primaryColor}; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 5px;">
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

/**
 * Generate HTML email template for payment reminder
 */
function generatePaymentReminderEmailHTML(params: {
  customerName: string;
  invoiceNo: number;
  invoiceUrl: string;
  pdfUrl: string;
  issueDate: Date | string;
  dueDate: Date | string;
  total: number;
  daysUntilDue?: number;
  daysOverdue?: number;
  organizationName?: string;
  reminderType?: 'upcoming' | 'overdue' | 'final';
}): string {
  const {
    customerName,
    invoiceNo,
    invoiceUrl,
    pdfUrl,
    issueDate,
    dueDate,
    total,
    daysUntilDue,
    daysOverdue,
    organizationName,
    reminderType = daysOverdue ? 'overdue' : 'upcoming'
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

  // Determine message based on reminder type
  let headerColor: string;
  let headerText: string;
  let messageText: string;
  let urgencyText: string = '';

  if (reminderType === 'final') {
    headerColor = '#dc2626';
    headerText = '⚠️ Final Notice - Payment Required';
    messageText = `This is a final notice regarding your overdue invoice. Immediate payment is required to avoid further action.`;
    urgencyText = daysOverdue
      ? `This invoice is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue.`
      : '';
  } else if (reminderType === 'overdue') {
    headerColor = '#f59e0b';
    headerText = '⏰ Payment Reminder - Invoice Overdue';
    messageText = `We hope this message finds you well. We noticed that Invoice #${invoiceNo} is now overdue.`;
    urgencyText = daysOverdue
      ? `This invoice is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue.`
      : '';
  } else {
    headerColor = '#2563eb';
    headerText = '📧 Friendly Payment Reminder';
    messageText = `This is a friendly reminder that payment for Invoice #${invoiceNo} is due soon.`;
    urgencyText = daysUntilDue
      ? `Payment is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}.`
      : '';
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerText} - Invoice #${invoiceNo}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: ${headerColor}; margin-top: 0; font-size: 24px;">${headerText}</h1>
    
    <p style="color: #666; font-size: 16px;">Hello ${customerName},</p>
    
    <p style="color: #666; font-size: 16px;">
      ${messageText}
    </p>
    
    ${urgencyText ? `<p style="color: ${headerColor}; font-size: 16px; font-weight: 600; margin: 20px 0;">${urgencyText}</p>` : ''}
    
    <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Invoice Number:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #333;">#${invoiceNo}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Issue Date:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #333;">${formattedIssueDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Due Date:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: ${reminderType === 'overdue' || reminderType === 'final' ? headerColor : '#333'}; font-weight: ${reminderType === 'overdue' || reminderType === 'final' ? '600' : 'normal'};">${formattedDueDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Total Amount:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 18px; font-weight: bold;">${formattedTotal}</td>
        </tr>
      </table>
    </div>
    
    <div style="margin: 30px 0; text-align: center;">
      <a href="${invoiceUrl}" 
         style="display: inline-block; background-color: ${headerColor}; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 5px;">
        View & Pay Invoice
      </a>
      <a href="${pdfUrl}" 
         style="display: inline-block; background-color: #ffffff; color: ${headerColor}; border: 2px solid ${headerColor}; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 5px;">
        Download PDF
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      ${
        reminderType === 'final'
          ? 'Please arrange payment immediately to avoid any service interruptions or additional fees.'
          : reminderType === 'overdue'
            ? 'We would appreciate prompt payment to avoid any inconvenience. If you have already made payment, please disregard this notice.'
            : "We appreciate your prompt attention to this matter. If you have any questions or concerns, please don't hesitate to contact us."
      }
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

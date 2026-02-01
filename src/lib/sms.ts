import twilio from 'twilio';
import { prisma } from './db';

if (!process.env.TWILIO_ACCOUNT_SID) {
  console.warn('TWILIO_ACCOUNT_SID is not set in environment variables');
}
if (!process.env.TWILIO_AUTH_TOKEN) {
  console.warn('TWILIO_AUTH_TOKEN is not set in environment variables');
}

// Default Twilio client from environment variables
const defaultTwilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export interface SendSMSParams {
  to: string;
  message: string;
  invoiceId?: string;
  smsType?: 'invoice' | 'payment_confirmation' | 'payment_reminder';
  organizationId?: string; // Optional organization ID to use org-specific settings
}

export interface SMSResult {
  success: boolean;
  twilioSid: string | null;
  status: string | null;
  error: string | null;
}

/**
 * Get Twilio configuration from organization settings or environment variables
 */
async function getTwilioConfig(organizationId?: string): Promise<{
  accountSid: string | null;
  authToken: string | null;
  fromNumber: string | null;
  client: twilio.Twilio | null;
}> {
  let accountSid: string | null = null;
  let authToken: string | null = null;
  let fromNumber: string | null = null;

  // If organizationId is provided, try to get settings from organization
  if (organizationId) {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          twilioAccountSid: true,
          twilioAuthToken: true,
          twilioFromNumber: true
        }
      });

      if (organization) {
        accountSid = organization.twilioAccountSid || null;
        authToken = organization.twilioAuthToken || null;
        fromNumber = organization.twilioFromNumber || null;
      }
    } catch (error) {
      console.error('Error fetching organization Twilio settings:', error);
      // Fall through to use environment variables
    }
  }

  // Fall back to environment variables if not set in organization
  if (!accountSid) {
    accountSid = process.env.TWILIO_ACCOUNT_SID || null;
  }
  if (!authToken) {
    authToken = process.env.TWILIO_AUTH_TOKEN || null;
  }
  if (!fromNumber) {
    fromNumber = process.env.TWILIO_FROM_NUMBER || null;
  }

  // Create Twilio client if credentials are available
  const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

  return { accountSid, authToken, fromNumber, client };
}

/**
 * Send an SMS via Twilio
 */
export async function sendSMS(params: SendSMSParams): Promise<SMSResult> {
  const { to, message, organizationId } = params;

  // Get Twilio configuration (organization settings first, then env vars)
  const config = await getTwilioConfig(organizationId);

  if (!config.client) {
    return {
      success: false,
      twilioSid: null,
      status: null,
      error:
        'Twilio client not initialized. Check organization settings or TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.'
    };
  }

  if (!config.fromNumber) {
    return {
      success: false,
      twilioSid: null,
      status: null,
      error:
        'Twilio from number not configured. Check organization settings or TWILIO_FROM_NUMBER environment variable.'
    };
  }

  try {
    const twilioMessage = await config.client.messages.create({
      body: message,
      from: config.fromNumber,
      to: to
    });

    return {
      success: twilioMessage.status !== 'failed',
      twilioSid: twilioMessage.sid,
      status: twilioMessage.status,
      error: null
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      success: false,
      twilioSid: null,
      status: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate SMS message for invoice notification
 */
export function generateInvoiceSMS(params: {
  customerName: string;
  invoiceNo: number;
  total: number;
  invoiceUrl: string;
  currency?: string;
  organizationName?: string;
}): string {
  const {
    customerName,
    invoiceNo,
    total,
    invoiceUrl,
    currency = 'USD',
    organizationName
  } = params;
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(total);

  // Shorten URL if needed (SMS has 160 character limit, but modern phones support longer)
  // For now, we'll use the full URL. Consider URL shortening service if needed.
  const orgName = organizationName ? `${organizationName}: ` : '';

  return `${orgName}Invoice #${invoiceNo} for ${formattedTotal} is ready. View & pay: ${invoiceUrl}`;
}

/**
 * Generate SMS message for payment confirmation
 */
export function generatePaymentConfirmationSMS(params: {
  customerName: string;
  invoiceNo: number;
  amount: number;
  invoiceUrl: string;
  currency?: string;
  organizationName?: string;
}): string {
  const {
    customerName,
    invoiceNo,
    amount,
    invoiceUrl,
    currency = 'USD',
    organizationName
  } = params;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);

  const orgName = organizationName ? `${organizationName}: ` : '';

  return `${orgName}Payment of ${formattedAmount} received for Invoice #${invoiceNo}. View: ${invoiceUrl}`;
}

/**
 * Generate SMS message for payment reminder
 */
export function generatePaymentReminderSMS(params: {
  customerName: string;
  invoiceNo: number;
  total: number;
  dueDate: Date;
  invoiceUrl: string;
  daysUntilDue?: number;
  daysOverdue?: number;
  reminderType: 'upcoming' | 'overdue' | 'final';
  currency?: string;
  organizationName?: string;
}): string {
  const {
    customerName,
    invoiceNo,
    total,
    dueDate,
    invoiceUrl,
    daysUntilDue,
    daysOverdue,
    reminderType,
    currency = 'USD',
    organizationName
  } = params;

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(total);

  const orgName = organizationName ? `${organizationName}: ` : '';

  let message: string;

  if (reminderType === 'final') {
    message = `FINAL NOTICE: Invoice #${invoiceNo} for ${formattedTotal} is ${daysOverdue} days overdue. Pay now: ${invoiceUrl}`;
  } else if (reminderType === 'overdue') {
    message = `Reminder: Invoice #${invoiceNo} for ${formattedTotal} is ${daysOverdue} days overdue. Pay: ${invoiceUrl}`;
  } else {
    message = `Reminder: Invoice #${invoiceNo} for ${formattedTotal} due in ${daysUntilDue} days. Pay: ${invoiceUrl}`;
  }

  return `${orgName}${message}`;
}

/**
 * Format phone number for Twilio (E.164 format)
 * Converts various formats to +1234567890
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If it starts with 1 and has 11 digits, it's already US format
  // If it has 10 digits, add +1
  // Otherwise, assume it's already in international format
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  } else if (phone.startsWith('+')) {
    return phone; // Already in E.164 format
  } else {
    return `+${cleaned}`;
  }
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Basic validation - E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

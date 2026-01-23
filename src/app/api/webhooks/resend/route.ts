import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

/**
 * Verify Resend webhook signature
 * Resend uses HMAC SHA256 to sign webhook payloads
 */
function verifyResendWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Resend sends signature in format: sha256=<hash>
    const receivedHash = signature.replace('sha256=', '');

    return receivedHash === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.RESEND_WEBHOOK_KEY;

    if (!webhookSecret) {
      console.error('RESEND_WEBHOOK_KEY is not set');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get signature from headers (Resend uses 'resend-signature' header)
    const signature =
      request.headers.get('resend-signature') ||
      request.headers.get('x-resend-signature');

    // Get raw body for verification
    const body = await request.text();

    // Verify webhook signature if provided
    if (signature) {
      const isValid = verifyResendWebhook(body, signature, webhookSecret);

      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } else {
      // In development, allow webhooks without signature for testing
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Missing signature header' },
          { status: 401 }
        );
      } else {
        console.warn('Webhook signature missing, allowing in development mode');
      }
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    const eventType = payload.type;

    // Handle different event types
    switch (eventType) {
      case 'email.sent':
      case 'email.delivered':
      case 'email.delivery_delayed':
      case 'email.opened':
      case 'email.clicked':
      case 'email.bounced':
      case 'email.complained':
      case 'email.failed':
      case 'email.received':
      case 'email.scheduled':
      case 'email.suppressed': {
        await handleEmailEvent(payload);
        break;
      }

      case 'contact.updated':
      case 'domain.created':
      case 'domain.deleted':
      case 'domain.updated': {
        // These events don't relate to specific emails, just log them
        console.log(`Resend webhook event: ${eventType}`, payload);
        break;
      }

      default:
        console.log(`Unhandled Resend webhook event: ${eventType}`, payload);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * Handle email-related webhook events
 */
async function handleEmailEvent(payload: any) {
  const { type, data } = payload;
  const emailId = data?.email_id || data?.emailId;

  if (!emailId) {
    console.warn('Email event missing email_id:', payload);
    return;
  }

  // Find the email log by Resend email ID
  const emailLog = await prisma.emailLog.findFirst({
    where: { resendId: emailId }
  });

  if (!emailLog) {
    // Email not found in our logs - might be from another system or old email
    console.warn(`Email log not found for Resend ID: ${emailId}`);
    return;
  }

  // Prepare metadata for the event
  const metadata: any = {};

  // Extract relevant data based on event type
  if (type === 'email.clicked' && data?.link) {
    metadata.link = data.link;
    metadata.linkUrl = data.link_url || data.linkUrl;
  }

  if (type === 'email.bounced' && data?.bounce_type) {
    metadata.bounceType = data.bounce_type;
    metadata.bounceReason = data.bounce_reason || data.bounceReason;
  }

  if (type === 'email.opened' && data?.location) {
    metadata.location = data.location;
    metadata.userAgent = data.user_agent || data.userAgent;
  }

  // Create email event record
  await prisma.emailEvent.create({
    data: {
      emailLogId: emailLog.id,
      eventType: type,
      metadata:
        Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
    }
  });

  // Update email log status based on event type
  if (type === 'email.delivered' && emailLog.status === 'sent') {
    // Email was successfully delivered
    // Status is already 'sent', no need to update
  } else if (type === 'email.bounced' || type === 'email.failed') {
    // Update email log status to failed if it bounces or fails
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: 'failed',
        errorMessage: metadata.bounceReason || 'Email delivery failed'
      }
    });
  }

  console.log(`Logged email event: ${type} for email ${emailId}`);
}

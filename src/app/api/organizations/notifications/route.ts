import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET - Get SMS and Email notification settings for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        // Email settings
        emailProvider: true,
        resendApiKey: true,
        resendFromEmail: true,
        resendFromName: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUsername: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
        // SMS settings
        twilioAccountSid: true,
        twilioAuthToken: true,
        twilioFromNumber: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Return settings (don't expose sensitive tokens in full)
    return NextResponse.json({
      email: {
        emailProvider: organization.emailProvider,
        resendApiKey: organization.resendApiKey
          ? `${organization.resendApiKey.substring(0, 8)}...`
          : null,
        resendFromEmail: organization.resendFromEmail,
        resendFromName: organization.resendFromName,
        smtpHost: organization.smtpHost,
        smtpPort: organization.smtpPort,
        smtpSecure: organization.smtpSecure,
        smtpUsername: organization.smtpUsername,
        smtpPassword: organization.smtpPassword
          ? `${organization.smtpPassword.substring(0, 8)}...`
          : null,
        smtpFromEmail: organization.smtpFromEmail,
        smtpFromName: organization.smtpFromName
      },
      sms: {
        twilioAccountSid: organization.twilioAccountSid,
        twilioAuthToken: organization.twilioAuthToken
          ? `${organization.twilioAuthToken.substring(0, 8)}...`
          : null,
        twilioFromNumber: organization.twilioFromNumber
      }
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update SMS and Email notification settings for the organization
 */
export async function PUT(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, sms } = body;

    const updateData: any = {};

    // Email settings
    if (email !== undefined) {
      // Email provider selection
      if (email.emailProvider !== undefined) {
        if (
          email.emailProvider &&
          !['resend', 'smtp'].includes(email.emailProvider)
        ) {
          return NextResponse.json(
            { error: 'Email provider must be either "resend" or "smtp"' },
            { status: 400 }
          );
        }
        updateData.emailProvider = email.emailProvider || null;
      }

      // Resend settings
      if (email.resendApiKey !== undefined) {
        // Only update if a new value is provided (not masked value like "re_1234...")
        // If it's a masked value (contains "..."), skip the update to preserve existing value
        // If it's empty string, set to null to clear it
        // Otherwise, update with the new value
        if (email.resendApiKey === '') {
          updateData.resendApiKey = null;
        } else if (email.resendApiKey && !email.resendApiKey.includes('...')) {
          updateData.resendApiKey = email.resendApiKey;
        }
        // If it contains "...", don't update (preserve existing value)
      }
      if (email.resendFromEmail !== undefined) {
        // Validate email format if provided
        if (
          email.resendFromEmail &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.resendFromEmail)
        ) {
          return NextResponse.json(
            { error: 'From email must be a valid email address' },
            { status: 400 }
          );
        }
        updateData.resendFromEmail = email.resendFromEmail || null;
      }
      if (email.resendFromName !== undefined) {
        updateData.resendFromName = email.resendFromName || null;
      }

      // SMTP settings
      if (email.smtpHost !== undefined) {
        updateData.smtpHost = email.smtpHost || null;
      }
      if (email.smtpPort !== undefined) {
        const port = email.smtpPort ? parseInt(email.smtpPort, 10) : null;
        if (port !== null && (isNaN(port) || port < 1 || port > 65535)) {
          return NextResponse.json(
            { error: 'SMTP port must be a number between 1 and 65535' },
            { status: 400 }
          );
        }
        updateData.smtpPort = port;
      }
      if (email.smtpSecure !== undefined) {
        updateData.smtpSecure =
          email.smtpSecure === true || email.smtpSecure === 'true';
      }
      if (email.smtpUsername !== undefined) {
        updateData.smtpUsername = email.smtpUsername || null;
      }
      if (email.smtpPassword !== undefined) {
        // Only update if a new value is provided (not masked value like "12345678...")
        if (email.smtpPassword === '') {
          updateData.smtpPassword = null;
        } else if (email.smtpPassword && !email.smtpPassword.includes('...')) {
          updateData.smtpPassword = email.smtpPassword;
        }
        // If it contains "...", don't update (preserve existing value)
      }
      if (email.smtpFromEmail !== undefined) {
        // Validate email format if provided
        if (
          email.smtpFromEmail &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.smtpFromEmail)
        ) {
          return NextResponse.json(
            { error: 'SMTP from email must be a valid email address' },
            { status: 400 }
          );
        }
        updateData.smtpFromEmail = email.smtpFromEmail || null;
      }
      if (email.smtpFromName !== undefined) {
        updateData.smtpFromName = email.smtpFromName || null;
      }
    }

    // SMS settings
    if (sms !== undefined) {
      if (sms.twilioAccountSid !== undefined) {
        updateData.twilioAccountSid = sms.twilioAccountSid || null;
      }
      if (sms.twilioAuthToken !== undefined) {
        // Only update if a new value is provided (not masked value like "12345678...")
        // If it's a masked value (contains "..."), skip the update to preserve existing value
        // If it's empty string, set to null to clear it
        // Otherwise, update with the new value
        if (sms.twilioAuthToken === '') {
          updateData.twilioAuthToken = null;
        } else if (
          sms.twilioAuthToken &&
          !sms.twilioAuthToken.includes('...')
        ) {
          updateData.twilioAuthToken = sms.twilioAuthToken;
        }
        // If it contains "...", don't update (preserve existing value)
      }
      if (sms.twilioFromNumber !== undefined) {
        // Validate phone number format (E.164)
        if (
          sms.twilioFromNumber &&
          !/^\+[1-9]\d{1,14}$/.test(sms.twilioFromNumber)
        ) {
          return NextResponse.json(
            {
              error:
                'From phone number must be in E.164 format (e.g., +1234567890)'
            },
            { status: 400 }
          );
        }
        updateData.twilioFromNumber = sms.twilioFromNumber || null;
      }
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        id: true,
        emailProvider: true,
        resendApiKey: true,
        resendFromEmail: true,
        resendFromName: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUsername: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
        twilioAccountSid: true,
        twilioAuthToken: true,
        twilioFromNumber: true
      }
    });

    // Return settings (don't expose sensitive tokens in full)
    return NextResponse.json({
      email: {
        emailProvider: updated.emailProvider,
        resendApiKey: updated.resendApiKey
          ? `${updated.resendApiKey.substring(0, 8)}...`
          : null,
        resendFromEmail: updated.resendFromEmail,
        resendFromName: updated.resendFromName,
        smtpHost: updated.smtpHost,
        smtpPort: updated.smtpPort,
        smtpSecure: updated.smtpSecure,
        smtpUsername: updated.smtpUsername,
        smtpPassword: updated.smtpPassword
          ? `${updated.smtpPassword.substring(0, 8)}...`
          : null,
        smtpFromEmail: updated.smtpFromEmail,
        smtpFromName: updated.smtpFromName
      },
      sms: {
        twilioAccountSid: updated.twilioAccountSid,
        twilioAuthToken: updated.twilioAuthToken
          ? `${updated.twilioAuthToken.substring(0, 8)}...`
          : null,
        twilioFromNumber: updated.twilioFromNumber
      }
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}

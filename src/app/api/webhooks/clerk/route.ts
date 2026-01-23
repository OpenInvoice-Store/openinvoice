import { prisma } from '@/lib/db';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Get the Svix headers for verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Get the webhook secret
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new NextResponse('Error: WEBHOOK_SECRET is not set', {
      status: 500,
    });
  }

  // Create a new Svix instance with your secret
  const wh = new Webhook(webhookSecret);

  let evt: any;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new NextResponse('Error occurred -- verification failed', {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  try {
    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data;

        const primaryEmail = email_addresses?.find(
          (email: any) => email.id === evt.data.primary_email_address_id
        )?.email_address;

        await prisma.user.upsert({
          where: { clerkUserId: id },
          update: {
            email: primaryEmail || email_addresses?.[0]?.email_address,
            firstName: first_name || null,
            lastName: last_name || null,
            imageUrl: image_url || null,
            updatedAt: new Date(),
          },
          create: {
            id,
            clerkUserId: id,
            email: primaryEmail || email_addresses?.[0]?.email_address,
            firstName: first_name || null,
            lastName: last_name || null,
            imageUrl: image_url || null,
          },
        });

        console.log(`User ${eventType}:`, id);
        break;
      }

      case 'user.deleted': {
        const { id } = evt.data;

        await prisma.user.delete({
          where: { clerkUserId: id },
        }).catch((err: unknown) => {
          // User might already be deleted or not exist
          console.log('User not found for deletion:', id);
        });

        console.log(`User deleted:`, id);
        break;
      }

      case 'organization.created':
      case 'organization.updated': {
        const { id, name, slug, image_url } = evt.data;

        await prisma.organization.upsert({
          where: { clerkOrgId: id },
          update: {
            name: name || 'Unnamed Organization',
            slug: slug || null,
            imageUrl: image_url || null,
            updatedAt: new Date(),
          },
          create: {
            id,
            clerkOrgId: id,
            name: name || 'Unnamed Organization',
            slug: slug || null,
            imageUrl: image_url || null,
          },
        });

        console.log(`Organization ${eventType}:`, id);
        break;
      }

      case 'organization.deleted': {
        const { id } = evt.data;

        await prisma.organization.delete({
          where: { clerkOrgId: id },
        }).catch((err: unknown) => {
          // Organization might already be deleted or not exist
          console.log('Organization not found for deletion:', id);
        });

        console.log(`Organization deleted:`, id);
        break;
      }

      case 'organizationMembership.created':
      case 'organizationMembership.updated': {
        const { id, organization, public_user_data, role } = evt.data;

        // Ensure user exists first
        const userId = public_user_data.user_id;
        const user = await prisma.user.findUnique({
          where: { clerkUserId: userId },
        });

        if (!user) {
          console.log(`User ${userId} not found, skipping membership creation`);
          break;
        }

        // Ensure organization exists
        const orgId = organization.id;
        const org = await prisma.organization.findUnique({
          where: { clerkOrgId: orgId },
        });

        if (!org) {
          console.log(`Organization ${orgId} not found, skipping membership creation`);
          break;
        }

        await prisma.organizationMember.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: org.id,
            },
          },
          update: {
            role: role || 'member',
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            organizationId: org.id,
            role: role || 'member',
          },
        });

        console.log(`Membership ${eventType}:`, { userId, orgId, role });
        break;
      }

      case 'organizationMembership.deleted': {
        const { organization, public_user_data } = evt.data;

        const userId = public_user_data.user_id;
        const orgId = organization.id;

        // Find the user and organization in our DB
        const user = await prisma.user.findUnique({
          where: { clerkUserId: userId },
        });

        const org = await prisma.organization.findUnique({
          where: { clerkOrgId: orgId },
        });

        if (user && org) {
          await prisma.organizationMember.deleteMany({
            where: {
              userId: user.id,
              organizationId: org.id,
            },
          }).catch((err: unknown) => {
            console.log('Membership not found for deletion');
          });
        }

        console.log(`Membership deleted:`, { userId, orgId });
        break;
      }

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return new NextResponse('Webhook processed successfully', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Error processing webhook', { status: 500 });
  }
}


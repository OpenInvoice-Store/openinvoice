import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

/**
 * Syncs user and organization data from Clerk to the database.
 * This is a fallback mechanism when webhooks fail or haven't fired yet.
 *
 * @returns The synced user and organization, or null if user is not authenticated
 */
export async function syncUserAndOrganization() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return null;
    }

    // Get current user from Clerk
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return null;
    }

    // Sync user to database
    const primaryEmail =
      clerkUser.emailAddresses?.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      )?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress;

    const user = await prisma.user.upsert({
      where: { clerkUserId: userId },
      update: {
        email: primaryEmail || null,
        firstName: clerkUser.firstName || null,
        lastName: clerkUser.lastName || null,
        imageUrl: clerkUser.imageUrl || null,
        updatedAt: new Date()
      },
      create: {
        id: userId,
        clerkUserId: userId,
        email: primaryEmail || null,
        firstName: clerkUser.firstName || null,
        lastName: clerkUser.lastName || null,
        imageUrl: clerkUser.imageUrl || null
      }
    });

    // If there's an active organization, sync it too
    let organization = null;
    if (orgId) {
      // Get organization data from Clerk
      // Note: We need to use Clerk's backend API to get full org details
      // For now, we'll create/update with basic info and let webhooks handle full sync
      organization = await prisma.organization.upsert({
        where: { clerkOrgId: orgId },
        update: {
          updatedAt: new Date()
        },
        create: {
          id: orgId,
          clerkOrgId: orgId,
          name: 'Unnamed Organization' // Default name, webhook will update with real name
        }
      });

      // Ensure user is a member of the organization
      await prisma.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: organization.id
          }
        },
        update: {
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          organizationId: organization.id,
          role: 'member' // Default role, webhook will update with real role
        }
      });
    }

    return { user, organization };
  } catch (error) {
    console.error('Error syncing user and organization:', error);
    throw error;
  }
}

/**
 * Ensures the user and organization exist in the database.
 * This is a lightweight check that syncs if needed.
 *
 * @returns The organization ID if available, or null
 */
export async function ensureUserAndOrganization() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return null;
    }

    // Quick check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, clerkUserId: true } // Only select fields that definitely exist
    });

    // If user doesn't exist, sync everything
    if (!existingUser) {
      await syncUserAndOrganization();
      return orgId;
    }

    // If orgId is provided but org doesn't exist, sync it
    if (orgId) {
      const existingOrg = await prisma.organization.findUnique({
        where: { clerkOrgId: orgId },
        select: { id: true, clerkOrgId: true } // Only select fields that definitely exist
      });

      if (!existingOrg) {
        await syncUserAndOrganization();
      }
    }

    return orgId;
  } catch (error) {
    console.error('Error ensuring user and organization:', error);
    // Don't throw, just return null to allow graceful degradation
    return null;
  }
}

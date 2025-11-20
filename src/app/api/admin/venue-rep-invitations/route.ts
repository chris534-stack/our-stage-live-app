import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { VenueRepresentativeInvitation } from '@/lib/types';
import crypto from 'crypto';

// Note: Admin authentication is handled at the UI level via AdminAuthGuard
// This mirrors the reviewer invitations route pattern

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// PATCH - Rotate short claim code for an unbound invitation (pending only)
export async function PATCH(request: NextRequest) {
  try {
    const { invitationId, action, claimCodeLength, claimCodeMaxAttempts } = await request.json();

    if (!invitationId || action !== 'rotateClaimCode') {
      return NextResponse.json({ error: 'Invalid request. Provide invitationId and action=rotateClaimCode' }, { status: 400 });
    }

    const invitationRef = adminDb.collection('venueRepInvitations').doc(invitationId);
    const invitationDoc = await invitationRef.get();
    if (!invitationDoc.exists) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitationData = invitationDoc.data() as VenueRepresentativeInvitation;
    if (invitationData.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot rotate code for a ${invitationData.status} invitation. Only pending invitations are supported.` },
        { status: 400 }
      );
    }
    if (!invitationData.isUnbound) {
      return NextResponse.json({ error: 'Code rotation is only supported for unbound invitations' }, { status: 400 });
    }

    const length = typeof claimCodeLength === 'number' && claimCodeLength >= 4 && claimCodeLength <= 10 ? claimCodeLength : 6;
    const newCode = generateNumericCode(length);
    const { hash, salt } = hashClaimCode(newCode);

    const updateData: Partial<VenueRepresentativeInvitation> & Record<string, any> = {
      claimCodeHash: hash,
      claimCodeSalt: salt,
      claimCodeAttemptCount: 0,
      claimCodeLocked: false,
      claimCodeLockedAt: undefined,
    };
    if (typeof claimCodeMaxAttempts === 'number' && claimCodeMaxAttempts > 0) {
      updateData.claimCodeMaxAttempts = claimCodeMaxAttempts;
    }

    await invitationRef.update(updateData as any);

    return NextResponse.json({
      success: true,
      invitationId,
      claimCode: newCode, // Return new short code once
      message: 'Claim code rotated successfully',
    });
  } catch (error) {
    console.error('Error rotating claim code:', error);
    return NextResponse.json({ error: 'Failed to rotate claim code' }, { status: 500 });
  }
}

function generateNumericCode(length: number): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, digits.length);
    code += digits[idx];
  }
  return code;
}

function hashClaimCode(code: string, salt?: string) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(code, s, 32).toString('hex');
  return { hash, salt: s };
}

function getBaseUrl(request: NextRequest): string {
  // 1) Explicit env override
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/$/, '');

  // 2) Headers provided by proxies (Vercel, etc.)
  const headers = request.headers;
  const forwardedProto = headers.get('x-forwarded-proto');
  const vercelUrl = headers.get('x-vercel-deployment-url');
  const forwardedHost = headers.get('x-forwarded-host');
  const host = forwardedHost || vercelUrl || headers.get('host');

  if (host) {
    const proto = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  // 3) Last resort
  return 'http://localhost:3000';
}

// GET - Fetch all venue rep invitations
export async function GET(_request: NextRequest) {
  try {
    const invitationsRef = adminDb.collection('venueRepInvitations');
    const snapshot = await invitationsRef.orderBy('createdAt', 'desc').get();

    const invitations: VenueRepresentativeInvitation[] = [];
    snapshot.forEach((doc) => {
      invitations.push({ id: doc.id, ...(doc.data() as any) } as VenueRepresentativeInvitation);
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching venue rep invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}

// POST - Create new venue rep invitation
export async function POST(request: NextRequest) {
  try {
    const {
      email,
      assignedVenueIds,
      isUnbound,
      claimCodeLength,
      claimCodeMaxAttempts,
      ttlHours,
    } = await request.json();

    const unbound: boolean = isUnbound === true;
    if (!unbound) {
      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
      }
    }

    if (!Array.isArray(assignedVenueIds) || assignedVenueIds.length === 0 || !assignedVenueIds.every((v) => typeof v === 'string' && v.trim() !== '')) {
      return NextResponse.json({ error: 'assignedVenueIds must be a non-empty array of venue IDs' }, { status: 400 });
    }

    const emailLower = (email || '').toLowerCase();

    // Validate that all venue IDs exist
    const venueChecks = await Promise.all(
      assignedVenueIds.map(async (id: string) => {
        const snap = await adminDb.collection('venues').doc(id).get();
        return snap.exists;
      })
    );
    if (venueChecks.some((exists) => !exists)) {
      return NextResponse.json({ error: 'One or more assigned venues do not exist' }, { status: 400 });
    }

    if (!unbound) {
      // Prevent duplicate pending invites for the same email
      const existingInviteQuery = await adminDb
        .collection('venueRepInvitations')
        .where('email', '==', emailLower)
        .where('status', '==', 'pending')
        .get();

      if (!existingInviteQuery.empty) {
        return NextResponse.json({ error: 'Pending invitation already exists for this email' }, { status: 400 });
      }
    }

    // If user exists and already has all requested venue assignments, block
    if (!unbound) {
      const userProfilesQuery = await adminDb.collection('userProfiles').where('email', '==', emailLower).get();
      if (!userProfilesQuery.empty) {
        const profile = userProfilesQuery.docs[0].data() as { isVenueRep?: boolean; assignedVenueIds?: string[] };
        if (profile.isVenueRep && Array.isArray(profile.assignedVenueIds)) {
          const hasAll = assignedVenueIds.every((id: string) => profile.assignedVenueIds!.includes(id));
          if (hasAll) {
            return NextResponse.json({ error: 'User is already a venue representative for these venues' }, { status: 400 });
          }
        }
      }
    }

    // Create invitation
    const token = generateSecureToken();
    const now = new Date();
    const defaultTtlHours = unbound ? 72 : (24 * 7);
    const actualTtlHours = typeof ttlHours === 'number' && ttlHours > 0 ? ttlHours : defaultTtlHours;
    const expiresAt = new Date(now.getTime() + actualTtlHours * 60 * 60 * 1000);

    // Base invitation
    const invitationBase: Omit<VenueRepresentativeInvitation, 'id'> = {
      email: unbound ? '' : emailLower,
      token,
      invitedBy: 'admin', // Simplified since auth is handled at UI level
      invitedByName: 'Admin',
      assignedVenueIds,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
      ...(unbound
        ? {
            isUnbound: true,
            claimCodeAttemptCount: 0,
            claimCodeMaxAttempts: typeof claimCodeMaxAttempts === 'number' && claimCodeMaxAttempts > 0 ? claimCodeMaxAttempts : 5,
            claimCodeLocked: false,
          }
        : {}),
    } as any;

    let claimCode: string | undefined;
    if (unbound) {
      const length = typeof claimCodeLength === 'number' && claimCodeLength >= 4 && claimCodeLength <= 10 ? claimCodeLength : 6;
      claimCode = generateNumericCode(length);
      const { hash, salt } = hashClaimCode(claimCode);
      (invitationBase as any).claimCodeHash = hash;
      (invitationBase as any).claimCodeSalt = salt;
    }

    const docRef = await adminDb.collection('venueRepInvitations').add(invitationBase);

    const baseUrl = getBaseUrl(request);
    const inviteLink = `${baseUrl}/invite/venue-rep/${token}`;

    const responsePayload: any = {
      success: true,
      invitationId: docRef.id,
      inviteLink,
      message: 'Venue representative invitation created successfully',
    };
    if (unbound && claimCode) {
      // Return the claim code ONLY in the creation response; it is not stored in Firestore.
      responsePayload.claimCode = claimCode;
      responsePayload.ttlHours = actualTtlHours;
      responsePayload.claimCodeMaxAttempts = invitationBase.claimCodeMaxAttempts;
    }
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error creating venue rep invitation:', error);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}

// DELETE - Delete a venue rep invitation (pending only)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    const invitationRef = adminDb.collection('venueRepInvitations').doc(invitationId);
    const invitationDoc = await invitationRef.get();
    if (!invitationDoc.exists) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitationData = invitationDoc.data() as VenueRepresentativeInvitation;
    if (invitationData.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot delete ${invitationData.status} invitation. Only pending invitations can be deleted.` },
        { status: 400 }
      );
    }

    await invitationRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Invitation deleted successfully',
      deletedInvitation: { id: invitationId, email: invitationData.email, status: invitationData.status },
    });
  } catch (error) {
    console.error('Error deleting venue rep invitation:', error);
    return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from 'firebase-admin';
import type { VenueRepresentativeInvitation, UserProfile } from '@/lib/types';
import { admin } from '@/lib/firebase-admin';
import crypto from 'crypto';

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

function verifyClaimCode(code: string, salt: string, expectedHash: string): boolean {
  const hash = crypto.scryptSync(code, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

// GET - Validate invitation token and get invitation details
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const invitationQuery = await adminDb
      .collection('venueRepInvitations')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (invitationQuery.empty) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    const invitationDoc = invitationQuery.docs[0];
    const invitation = { id: invitationDoc.id, ...invitationDoc.data() } as VenueRepresentativeInvitation;

    if (new Date() > new Date(invitation.expiresAt)) {
      await invitationDoc.ref.update({ status: 'expired' });
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: invitation.status === 'accepted' ? 'Invitation already accepted' : 'Invitation expired' },
        { status: 410 }
      );
    }

    const { token: _omit, claimCodeHash: _h, claimCodeSalt: _s, claimCodeAttemptCount: _ac, ...rest } = invitation as any;
    return NextResponse.json({ invitation: rest });
  } catch (error) {
    console.error('Error validating venue rep invitation:', error);
    return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
  }
}

// POST - Accept invitation and grant venue-rep privileges
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const { firebaseToken, claimCode, policyAcceptedVersion } = await request.json();

    if (!token || !firebaseToken) {
      return NextResponse.json({ error: 'Token and Firebase token are required' }, { status: 400 });
    }

    const decodedToken = await auth().verifyIdToken(firebaseToken);
    const userEmail = decodedToken.email?.toLowerCase();
    const userId = decodedToken.uid;

    if (!userEmail || !userId) {
      return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401 });
    }

    const invitationQuery = await adminDb
      .collection('venueRepInvitations')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (invitationQuery.empty) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    const invitationDoc = invitationQuery.docs[0];
    const invitation = { id: invitationDoc.id, ...invitationDoc.data() } as VenueRepresentativeInvitation;

    if (new Date() > new Date(invitation.expiresAt)) {
      await invitationDoc.ref.update({ status: 'expired' });
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already processed' }, { status: 410 });
    }

    // Basic IP-based rate limiting per invitation: max 5 attempts per 10 minutes per IP
    const ip = getClientIp(request);
    try {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const attemptsSnap = await adminDb
        .collection('venueRepInvitations')
        .doc(invitation.id)
        .collection('redeemAttempts')
        .where('ip', '==', ip)
        .where('attemptedAt', '>=', tenMinAgo)
        .get();
      if (attemptsSnap.size >= 5) {
        return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
      }
    } catch (e) {
      // Non-fatal: continue without blocking if logging fails
    }

    // For unbound invites, require a valid claimCode and enforce attempt counters and lockout
    if (invitation.isUnbound) {
      if (invitation.claimCodeLocked) {
        return NextResponse.json({ error: 'This invitation has been locked due to too many failed attempts.' }, { status: 423 });
      }
      if (!claimCode || typeof claimCode !== 'string') {
        return NextResponse.json({ error: 'Claim code is required for this invitation.' }, { status: 400 });
      }
      const salt = invitation.claimCodeSalt || '';
      const expectedHash = invitation.claimCodeHash || '';
      const isValid = salt && expectedHash ? verifyClaimCode(claimCode, salt, expectedHash) : false;
      if (!isValid) {
        // Increment attempt counter atomically and possibly lock
        await adminDb.runTransaction(async (tx) => {
          const ref = adminDb.collection('venueRepInvitations').doc(invitation.id);
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const data = snap.data() as VenueRepresentativeInvitation;
          const current = data.claimCodeAttemptCount || 0;
          const max = data.claimCodeMaxAttempts || 5;
          const next = current + 1;
          const updates: Partial<VenueRepresentativeInvitation> = { claimCodeAttemptCount: next };
          if (next >= max) {
            (updates as any).claimCodeLocked = true;
            (updates as any).claimCodeLockedAt = new Date().toISOString();
          }
          tx.update(ref, updates as any);
        });
        // Audit log
        try {
          await adminDb
            .collection('venueRepInvitations')
            .doc(invitation.id)
            .collection('redeemAttempts')
            .add({ attemptedAt: new Date().toISOString(), ip, success: false, reason: 'invalid_code', userId });
        } catch {}
        const remaining = Math.max(0, (invitation.claimCodeMaxAttempts || 5) - ((invitation.claimCodeAttemptCount || 0) + 1));
        return NextResponse.json({ error: `Invalid code. ${remaining} attempt(s) remaining.` }, { status: 403 });
      }
    } else {
      // Bound invites require email match
      const invitedEmail = invitation.email.toLowerCase();
      if (userEmail !== invitedEmail) {
        return NextResponse.json(
          { error: `This invitation was sent to ${invitation.email}, but you signed in with ${userEmail}. Please sign in with the correct email or contact the admin for assistance.` },
          { status: 403 }
        );
      }
    }

    // Create or update user profile with venue-rep privileges and merge assigned venues
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);
    const existingProfileDoc = await userProfileRef.get();
    const existingData = (existingProfileDoc.exists ? (existingProfileDoc.data() as UserProfile) : null) || undefined;

    const baseProfileUpdates: Partial<UserProfile> = {
      userId,
      email: userEmail,
      displayName: decodedToken.name || userEmail.split('@')[0],
      photoURL: existingData?.photoURL || decodedToken.picture || '',
      isVenueRep: true,
      authStatus: 'active',
      // Initialize onboarding flags if missing
      hasSeenVenueRepIntro: existingData?.hasSeenVenueRepIntro ?? false,
      venueRepOnboardingCompleted: existingData?.venueRepOnboardingCompleted ?? false,
    };

    if (existingProfileDoc.exists) {
      await userProfileRef.update({
        ...baseProfileUpdates,
        assignedVenueIds: admin.firestore.FieldValue.arrayUnion(...(invitation.assignedVenueIds || [])),
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Create a minimal profile document required for permissions; no public profile needed
      await userProfileRef.set({
        ...baseProfileUpdates,
        assignedVenueIds: invitation.assignedVenueIds || [],
        hasSeenVenueRepIntro: false,
        venueRepOnboardingCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // If a policy Accepted version is supplied, record it
    if (policyAcceptedVersion) {
      try {
        await userProfileRef.update({
          venueRepPolicyAccepted: true,
          venueRepPolicyAcceptedVersion: String(policyAcceptedVersion),
          updatedAt: new Date().toISOString(),
        } as any);
      } catch {}
    }

    await invitationDoc.ref.update({
      status: 'accepted',
      usedAt: new Date().toISOString(),
      acceptedByUserId: userId,
      archived: true,
    });

    // Audit success
    try {
      const ip = getClientIp(request);
      await adminDb
        .collection('venueRepInvitations')
        .doc(invitation.id)
        .collection('redeemAttempts')
        .add({ attemptedAt: new Date().toISOString(), ip, success: true, userId });
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Venue representative invitation accepted successfully',
      // Redirect to calendar with onboarding enabled
      redirectTo: '/calendar?onboarding=venue-rep',
    });
  } catch (error) {
    console.error('Error accepting venue rep invitation:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}

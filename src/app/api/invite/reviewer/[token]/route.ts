import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from 'firebase-admin';
import type { ReviewerInvitation, UserProfile } from '@/lib/types';

// GET - Validate invitation token and get invitation details
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find invitation by token
    const invitationQuery = await adminDb
      .collection('reviewerInvitations')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (invitationQuery.empty) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    const invitationDoc = invitationQuery.docs[0];
    const invitation = { id: invitationDoc.id, ...invitationDoc.data() } as ReviewerInvitation;

    // Check if invitation is expired
    if (new Date() > new Date(invitation.expiresAt)) {
      // Update status to expired
      await invitationDoc.ref.update({ status: 'expired' });
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Check if invitation is already used
    if (invitation.status !== 'pending') {
      return NextResponse.json({ 
        error: invitation.status === 'accepted' ? 'Invitation already accepted' : 'Invitation expired' 
      }, { status: 410 });
    }

    // Return invitation details (without sensitive token)
    const { token: _, ...safeInvitation } = invitation;
    return NextResponse.json({ invitation: safeInvitation });

  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
  }
}

// POST - Accept invitation (called after user signs in with Google)
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const { firebaseToken } = await request.json();

    if (!token || !firebaseToken) {
      return NextResponse.json({ error: 'Token and Firebase token are required' }, { status: 400 });
    }

    // Verify the Firebase token
    const decodedToken = await auth().verifyIdToken(firebaseToken);
    const userEmail = decodedToken.email?.toLowerCase();
    const userId = decodedToken.uid;

    if (!userEmail || !userId) {
      return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401 });
    }

    // Find invitation by token
    const invitationQuery = await adminDb
      .collection('reviewerInvitations')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (invitationQuery.empty) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    const invitationDoc = invitationQuery.docs[0];
    const invitation = { id: invitationDoc.id, ...invitationDoc.data() } as ReviewerInvitation;

    // Check if invitation is expired
    if (new Date() > new Date(invitation.expiresAt)) {
      await invitationDoc.ref.update({ status: 'expired' });
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Check if invitation is already used
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation already processed' }, { status: 410 });
    }

    // Verify email matches (allow some flexibility for different email addresses)
    const invitedEmail = invitation.email.toLowerCase();
    if (userEmail !== invitedEmail) {
      // For now, we'll be strict about email matching
      // In the future, we could add a verification step here
      return NextResponse.json({ 
        error: `This invitation was sent to ${invitation.email}, but you signed in with ${userEmail}. Please sign in with the correct email or contact the admin for assistance.` 
      }, { status: 403 });
    }

    // Create or update user profile with reviewer privileges
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);
    const existingProfileDoc = await userProfileRef.get();
    const existingData = existingProfileDoc.exists ? existingProfileDoc.data() as UserProfile : null;

    const profileData: Partial<UserProfile> = {
      userId,
      email: userEmail,
      displayName: decodedToken.name || userEmail.split('@')[0],
      // Only set photoURL if it doesn't already exist
      photoURL: existingData?.photoURL || decodedToken.picture || '',
      isReviewer: true, // Grant reviewer privileges
      authStatus: 'active'
    };

    if (existingProfileDoc.exists) {
      // Update existing profile to add reviewer privileges
      await userProfileRef.update({
        ...profileData,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Create new profile with reviewer privileges
      await userProfileRef.set({
        ...profileData,
        bio: '',
        roleInCommunity: 'Audience',
        showEmail: false,
        galleryImageUrls: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Mark invitation as accepted and archive it
    await invitationDoc.ref.update({
      status: 'accepted',
      usedAt: new Date().toISOString(),
      acceptedByUserId: userId,
      archived: true // Automatically archive accepted invitations
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Reviewer invitation accepted successfully',
      redirectTo: '/profile' // Redirect to their profile page
    });

  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}

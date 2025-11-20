import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ReviewerInvitation } from '@/lib/types';
import crypto from 'crypto';

// Note: Admin authentication is handled at the UI level via AdminAuthGuard
// This matches the pattern used by other admin API routes

// Generate secure token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getBaseUrl(request: NextRequest): string {
  // Prefer explicit env configuration
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/$/, '');

  // Infer from proxy headers (Vercel, etc.)
  const headers = request.headers;
  const forwardedProto = headers.get('x-forwarded-proto');
  const vercelUrl = headers.get('x-vercel-deployment-url');
  const forwardedHost = headers.get('x-forwarded-host');
  const host = forwardedHost || vercelUrl || headers.get('host');

  if (host) {
    const proto = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  // Fallback for local/dev
  return 'http://localhost:3000';
}

// GET - Fetch all reviewer invitations
export async function GET(request: NextRequest) {
  try {

    const invitationsRef = adminDb.collection('reviewerInvitations');
    const snapshot = await invitationsRef.orderBy('createdAt', 'desc').get();
    
    const invitations: ReviewerInvitation[] = [];
    snapshot.forEach(doc => {
      invitations.push({ id: doc.id, ...doc.data() } as ReviewerInvitation);
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching reviewer invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}

// POST - Create new reviewer invitation
export async function POST(request: NextRequest) {
  try {

    const { email } = await request.json();
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const emailLower = email.toLowerCase();

    // Gmail-only restriction removed to allow any email provider.
    // The user will still need to sign in with a Google account.

    // Check if invitation already exists for this email
    const existingInviteQuery = await adminDb
      .collection('reviewerInvitations')
      .where('email', '==', emailLower)
      .where('status', '==', 'pending')
      .get();

    if (!existingInviteQuery.empty) {
      return NextResponse.json({ error: 'Pending invitation already exists for this email' }, { status: 400 });
    }

    // Check if user is already a reviewer
    const userProfilesQuery = await adminDb
      .collection('userProfiles')
      .where('email', '==', emailLower)
      .get();

    if (!userProfilesQuery.empty) {
      const userProfile = userProfilesQuery.docs[0].data();
      if (userProfile.isReviewer) {
        return NextResponse.json({ error: 'User is already a reviewer' }, { status: 400 });
      }
    }

    // Create invitation
    const token = generateSecureToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation: Omit<ReviewerInvitation, 'id'> = {
      email: emailLower,
      token,
      invitedBy: 'admin', // Simplified since auth is handled at UI level
      invitedByName: 'Admin',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending'
    };

    const docRef = await adminDb.collection('reviewerInvitations').add(invitation);
    
    // TODO: Send invitation email here
    // For now, we'll return the invitation link
    const baseUrl = getBaseUrl(request);
    const inviteLink = `${baseUrl}/invite/reviewer/${token}`;

    return NextResponse.json({ 
      success: true, 
      invitationId: docRef.id,
      inviteLink,
      message: 'Reviewer invitation created successfully'
    });

  } catch (error) {
    console.error('Error creating reviewer invitation:', error);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}

// DELETE - Delete a reviewer invitation
export async function DELETE(request: NextRequest) {
  console.log('DELETE API called');
  try {
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');
    console.log('DELETE request for invitation ID:', invitationId);
    
    if (!invitationId) {
      console.log('ERROR: No invitation ID provided');
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }
    
    // Get the invitation first to verify it exists and is pending
    console.log('Fetching invitation from database...');
    const invitationRef = adminDb.collection('reviewerInvitations').doc(invitationId);
    const invitationDoc = await invitationRef.get();
    
    if (!invitationDoc.exists) {
      console.log('ERROR: Invitation not found in database');
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    const invitationData = invitationDoc.data() as ReviewerInvitation;
    console.log('Found invitation:', { id: invitationId, email: invitationData.email, status: invitationData.status });
    
    // Only allow deletion of pending invitations
    if (invitationData.status !== 'pending') {
      console.log('ERROR: Cannot delete non-pending invitation:', invitationData.status);
      return NextResponse.json({ 
        error: `Cannot delete ${invitationData.status} invitation. Only pending invitations can be deleted.` 
      }, { status: 400 });
    }
    
    // Delete the invitation
    console.log('Attempting to delete invitation from database...');
    await invitationRef.delete();
    console.log('Invitation successfully deleted from database');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Invitation deleted successfully',
      deletedInvitation: {
        id: invitationId,
        email: invitationData.email,
        status: invitationData.status
      }
    });
    
  } catch (error) {
    console.error('Error deleting reviewer invitation:', error);
    return NextResponse.json(
      { error: 'Failed to delete invitation' },
      { status: 500 }
    );
  }
}

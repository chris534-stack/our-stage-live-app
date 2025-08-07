import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';
import type { ReviewerInvitation } from '@/lib/types';

/**
 * POST /api/debug/create-test-invitation
 * 
 * Creates a test invitation for debugging purposes.
 * This endpoint should only be available in development or to admin users.
 */
export async function POST(request: NextRequest) {
  try {
    // In production, you should add authentication/authorization here
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Create invitation
    const invitation: Omit<ReviewerInvitation, 'id'> = {
      email: email.toLowerCase(),
      token,
      invitedBy: 'debug-system',
      invitedByName: 'Debug System',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      status: 'pending',
    };

    // Save to database
    const docRef = await adminDb.collection('reviewerInvitations').add(invitation);

    return NextResponse.json({
      success: true,
      invitationId: docRef.id,
      token,
      email,
      expiresAt: invitation.expiresAt,
    });

  } catch (error) {
    console.error('Error creating test invitation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create test invitation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/debug/create-test-invitation
 * 
 * Cleanup endpoint to remove test data.
 */
export async function DELETE(request: NextRequest) {
  try {
    // In production, you should add authentication/authorization here
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Delete all invitations created by debug system
    const debugInvitations = await adminDb
      .collection('reviewerInvitations')
      .where('invitedBy', '==', 'debug-system')
      .get();

    const batch = adminDb.batch();
    debugInvitations.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Also cleanup any test user profiles
    const testProfiles = await adminDb
      .collection('userProfiles')
      .where('email', '>=', 'debug@')
      .where('email', '<', 'debugz@')
      .get();

    const profileBatch = adminDb.batch();
    testProfiles.docs.forEach(doc => {
      profileBatch.delete(doc.ref);
    });

    await profileBatch.commit();

    return NextResponse.json({
      success: true,
      deletedInvitations: debugInvitations.size,
      deletedProfiles: testProfiles.size,
    });

  } catch (error) {
    console.error('Error cleaning up test data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup test data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// PATCH - Update venue rep fields for a specific user
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const body = await request.json();
    const {
      assignedVenueIds,
      isVenueRep,
      hasSeenVenueRepIntro,
      venueRepOnboardingCompleted,
    } = body ?? {};

    if (
      typeof assignedVenueIds === 'undefined' &&
      typeof isVenueRep === 'undefined' &&
      typeof hasSeenVenueRepIntro === 'undefined' &&
      typeof venueRepOnboardingCompleted === 'undefined'
    ) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    // Validate assignedVenueIds if provided
    if (typeof assignedVenueIds !== 'undefined') {
      if (!Array.isArray(assignedVenueIds) || !assignedVenueIds.every((v) => typeof v === 'string')) {
        return NextResponse.json({ error: 'assignedVenueIds must be an array of strings' }, { status: 400 });
      }
    }

    // Load doc
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);
    const doc = await userProfileRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (typeof assignedVenueIds !== 'undefined') {
      updateData.assignedVenueIds = assignedVenueIds;
    }
    if (typeof isVenueRep === 'boolean') {
      updateData.isVenueRep = isVenueRep;
      if (isVenueRep === false) {
        // If disabling role, also clear assignments
        updateData.assignedVenueIds = [];
      }
    }
    if (typeof hasSeenVenueRepIntro === 'boolean') {
      updateData.hasSeenVenueRepIntro = hasSeenVenueRepIntro;
    }
    if (typeof venueRepOnboardingCompleted === 'boolean') {
      updateData.venueRepOnboardingCompleted = venueRepOnboardingCompleted;
    }

    await userProfileRef.update(updateData);

    return NextResponse.json({ success: true, userId, update: updateData });
  } catch (error) {
    console.error('Error updating venue rep:', error);
    return NextResponse.json({ error: 'Failed to update venue rep' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// PATCH - Update reviewer status for a user
export async function PATCH(request: NextRequest) {
  try {
    const { userId, isReviewer } = await request.json();
    
    if (!userId || typeof isReviewer !== 'boolean') {
      return NextResponse.json({ 
        error: 'Valid userId and isReviewer boolean are required' 
      }, { status: 400 });
    }
    
    console.log(`Admin updating reviewer status for user ${userId} to ${isReviewer}`);
    
    // Get the user profile document
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);
    const userProfileDoc = await userProfileRef.get();
    
    if (!userProfileDoc.exists) {
      return NextResponse.json({ 
        error: 'User profile not found' 
      }, { status: 404 });
    }
    
    // Update the isReviewer field
    await userProfileRef.update({
      isReviewer: isReviewer,
      updatedAt: new Date().toISOString()
    });
    
    const action = isReviewer ? 'granted' : 'removed';
    console.log(`Successfully ${action} reviewer privileges for user ${userId}`);
    
    return NextResponse.json({ 
      success: true,
      message: `Reviewer privileges ${action} successfully`,
      userId,
      isReviewer
    });
    
  } catch (error) {
    console.error('Error updating reviewer status:', error);
    return NextResponse.json(
      { error: 'Failed to update reviewer status' },
      { status: 500 }
    );
  }
}

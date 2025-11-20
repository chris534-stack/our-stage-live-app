import { NextRequest, NextResponse } from 'next/server';
import { deleteProfilePhotoAction } from '@/lib/actions';

// Ensure this route runs on the Node.js runtime so firebase-admin works in production
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'us-central1';

export async function POST(request: NextRequest) {
  try {
    const { userId, photoUrl, idToken } = await request.json();

    if (!userId || !photoUrl) {
      return NextResponse.json(
        { success: false, message: 'Missing userId or photoUrl.' },
        { status: 400 }
      );
    }

    // Call the server action
    const result = await deleteProfilePhotoAction(userId, photoUrl, idToken);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Photo deletion API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Deletion failed'
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { archived } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    // Handle archiving
    if (archived !== undefined) {
      await adminDb.collection('reviewerInvitations').doc(id).update({ archived });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating reviewer invitation:', error);
    return NextResponse.json(
      { error: 'Failed to update reviewer invitation' },
      { status: 500 }
    );
  }
}

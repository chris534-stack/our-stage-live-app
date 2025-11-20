/**
 * Delete Script API
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Delete all scenes first
    const scenesSnapshot = await adminDb
      .collection(`users/${userId}/scripts/${scriptId}/scenes`)
      .get();
    
    const batch = adminDb.batch();
    scenesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete the script
    const scriptRef = adminDb.doc(`users/${userId}/scripts/${scriptId}`);
    batch.delete(scriptRef);
    
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Delete Script] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete script' },
      { status: 500 }
    );
  }
}

/**
 * Edit Scene Lines API
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sceneId: string } }
) {
  try {
    const { id: scriptId, sceneId } = params;
    const userId = request.headers.get('x-user-id');
    const body = await request.json();
    const { lines } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = adminDb;
    const sceneRef = db.doc(`users/${userId}/scripts/${scriptId}/scenes/${sceneId}`);

    await sceneRef.update({
      lines,
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Edit Scene] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update scene' },
      { status: 500 }
    );
  }
}

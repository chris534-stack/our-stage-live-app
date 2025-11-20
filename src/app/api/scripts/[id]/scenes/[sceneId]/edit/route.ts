/**
 * Edit Scene Lines API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

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

    const db = getFirestore();
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

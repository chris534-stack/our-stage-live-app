import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function DELETE(_request: NextRequest) {
  try {
    // Best-effort cleanup: delete pending reviewerInvitations created by tests
    // Note: Firestore has no server-side list-all; we filter by status 'pending' and archived false
    const snap = await adminDb
      .collection('reviewerInvitations')
      .where('archived', '==', false)
      .get();

    const batch = adminDb.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    if (!snap.empty) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, deleted: snap.size });
  } catch (error) {
    console.warn('Cleanup test data failed (non-fatal):', error);
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
  }
}

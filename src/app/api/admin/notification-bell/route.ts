import { NextRequest, NextResponse } from 'next/server';
import { headers as getHeaders } from '@/lib/headers';
import { adminDb, admin } from '@/lib/firebase-admin';

// GET /api/admin/notification-bell
// Returns aggregated counts for admin notification bell
export async function GET(_request: NextRequest) {
  try {
    // Auth: verify Firebase ID token from Authorization header
    const hdrs = await getHeaders();
    const authHeader = hdrs.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;

    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }

    let decoded: import('firebase-admin').auth.DecodedIdToken | null = null;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Admin-only: require matching admin email if configured
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const isAdmin = adminEmail ? decoded?.email === adminEmail : true; // allow fallback in dev if not configured
    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Queries
    const [venueInvitesSnap, reviewerReqsSnap, listingReqsSnap] = await Promise.all([
      adminDb.collection('venueRepInvitations').where('status', '==', 'pending').get(),
      adminDb.collection('reviewerRequests').where('status', '==', 'pending').get(),
      adminDb.collection('listingRequests').where('status', '==', 'new').get(),
    ]);

    const venueRepInvitationsPending = venueInvitesSnap.docs.filter(d => (d.data() as any)?.archived !== true).length;
    const reviewerRequestsPending = reviewerReqsSnap.docs.filter(d => (d.data() as any)?.archived !== true).length;
    const listingRequestsNew = listingReqsSnap.size; // no archived flag for listing requests today

    const total = venueRepInvitationsPending + reviewerRequestsPending + listingRequestsNew;

    return NextResponse.json({
      venueRepInvitationsPending,
      reviewerRequestsPending,
      listingRequestsNew,
      total,
    });
  } catch (error) {
    console.error('Error in notification bell API:', error);
    return NextResponse.json({ error: 'Failed to fetch notification counts' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getReviewsByReviewer } from '@/lib/data';

export async function GET(
  request: NextRequest,
  { params }: { params: { reviewerId: string } }
) {
  try {
    const { reviewerId } = params;
    const reviews = await getReviewsByReviewer(reviewerId);

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviewer details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviewer details' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reviewerId: string } }
) {
  try {
    const { reviewerId } = params;
    const { isReviewer } = await request.json();

    if (typeof isReviewer !== 'boolean') {
      return NextResponse.json({ error: 'isReviewer must be a boolean' }, { status: 400 });
    }

    const userProfileRef = adminDb.collection('userProfiles').doc(reviewerId);
    
    await userProfileRef.update({
      isReviewer: isReviewer
    });

    return NextResponse.json({ success: true, message: `Reviewer status updated for ${reviewerId}` });

  } catch (error) {
    console.error('Error updating reviewer status:', error);
    return NextResponse.json(
      { error: 'Failed to update reviewer status' },
      { status: 500 }
    );
  }
}

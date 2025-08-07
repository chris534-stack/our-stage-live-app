import { NextResponse } from 'next/server';
import { getAllReviewerRequests } from '@/lib/data';

export async function GET() {
  try {
    const reviewerRequests = await getAllReviewerRequests();
    return NextResponse.json({ reviewerRequests });
  } catch (error) {
    console.error('Error fetching reviewer requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviewer requests' },
      { status: 500 }
    );
  }
}

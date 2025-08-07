import { NextResponse } from 'next/server';
import { getAllReviewers, getReviewerStats } from '@/lib/data';

export async function GET() {
  try {
    const [reviewers, stats] = await Promise.all([
      getAllReviewers(),
      getReviewerStats()
    ]);

    return NextResponse.json({
      reviewers,
      stats
    });
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviewers' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getAllSpotlights } from '@/lib/data';

export async function GET() {
  try {
    const spotlights = await getAllSpotlights();
    return NextResponse.json({ spotlights });
  } catch (error) {
    console.error('Error fetching all spotlights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spotlights' },
      { status: 500 }
    );
  }
}

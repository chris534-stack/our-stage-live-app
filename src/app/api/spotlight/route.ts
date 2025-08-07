import { NextResponse } from 'next/server';
import { getActiveSpotlight } from '@/lib/data';

export async function GET() {
  try {
    const activeSpotlight = await getActiveSpotlight();
    return NextResponse.json({ spotlight: activeSpotlight });
  } catch (error) {
    console.error('Error fetching active spotlight:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spotlight' },
      { status: 500 }
    );
  }
}

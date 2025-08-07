import { NextResponse } from 'next/server';
import { getAllEvents } from '@/lib/data';

export async function GET() {
  try {
    const events = await getAllEvents({ includeOccurrences: true });
    
    return NextResponse.json({
      events,
      success: true
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', success: false },
      { status: 500 }
    );
  }
}

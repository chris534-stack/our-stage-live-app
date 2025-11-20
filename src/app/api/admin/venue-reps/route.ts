import { NextResponse } from 'next/server';
import { getAllUserProfiles } from '@/lib/data';

// GET - List active venue representatives
export async function GET() {
  try {
    const users = await getAllUserProfiles();
    const reps = users.filter((u) => u.isVenueRep);
    return NextResponse.json(reps);
  } catch (error) {
    console.error('Error fetching venue reps:', error);
    return NextResponse.json({ error: 'Failed to fetch venue representatives' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAllUserProfiles } from '@/lib/data';

export async function GET() {
  try {
    const profiles = await getAllUserProfiles();
    
    // Filter out profiles without display names and sort by community start date
    const validProfiles = profiles
      .filter(profile => profile.displayName && profile.displayName.trim() !== '')
      .sort((a, b) => {
        // Sort by community start date (oldest first), then by display name
        if (a.communityStartDate && b.communityStartDate) {
          return a.communityStartDate.localeCompare(b.communityStartDate);
        }
        if (a.communityStartDate && !b.communityStartDate) return -1;
        if (!a.communityStartDate && b.communityStartDate) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

    return NextResponse.json(validProfiles);
  } catch (error) {
    console.error('Error fetching community profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community profiles' },
      { status: 500 }
    );
  }
}

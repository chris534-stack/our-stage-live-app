import { NextResponse } from 'next/server';
import { getAllUserProfiles, getAllReviews } from '@/lib/data';

export async function GET() {
  try {
    const [profiles, reviews] = await Promise.all([
      getAllUserProfiles(),
      getAllReviews(),
    ]);

    // Build review count and recency maps
    const now = Date.now();
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const reviewCounts: Record<string, number> = {};
    const lastReviewAt: Record<string, number> = {};
    for (const r of reviews) {
      const uid = r.reviewerId;
      reviewCounts[uid] = (reviewCounts[uid] || 0) + 1;
      const ts = new Date(r.createdAt).getTime();
      if (!lastReviewAt[uid] || ts > lastReviewAt[uid]) lastReviewAt[uid] = ts;
    }

    // Filter to valid display names (defensive; getAllUserProfiles already filters)
    const valid = profiles.filter(
      (p) => p.displayName && p.displayName.trim() !== ''
    );

    // Compute a score for each profile based on activity and completeness
    const scored = valid
      .map((p) => {
        const reviewsCount = reviewCounts[p.userId] || 0;
        const hasRecentReview =
          lastReviewAt[p.userId] && now - lastReviewAt[p.userId] <= NINETY_DAYS_MS;

        let score = 0;
        // Activity weights
        score += reviewsCount * 5; // reviews are highly valued
        if (hasRecentReview) score += 4; // recent activity boost

        // Profile completeness weights
        if (p.photoURL && p.photoURL.trim() !== '') score += 3;
        if (p.bio) {
          const len = p.bio.trim().length;
          if (len >= 120) score += 4; // substantial bio
          else if (len >= 40) score += 2;
          else if (len > 0) score += 1;
        }
        if (p.roleInCommunity) score += 1;
        if (Array.isArray(p.galleryImageUrls)) score += Math.min(3, p.galleryImageUrls.length);
        if (p.coverPhotoUrl) score += 1;
        if (p.isReviewer) score += 1; // recognized contributor

        return { profile: p, score, reviewsCount };
      })
      .sort((a, b) => {
        // Primary: score desc
        if (b.score !== a.score) return b.score - a.score;
        // Secondary: reviews count desc
        if (b.reviewsCount !== a.reviewsCount) return b.reviewsCount - a.reviewsCount;
        // Tertiary: earlier communityStartDate first if both present
        const aStart = a.profile.communityStartDate || '';
        const bStart = b.profile.communityStartDate || '';
        if (aStart && bStart && aStart !== bStart) return aStart.localeCompare(bStart);
        // Fallback: display name alpha
        return a.profile.displayName.localeCompare(b.profile.displayName);
      })
      .map((x) => x.profile);

    return NextResponse.json(scored);
  } catch (error) {
    console.error('Error fetching community profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community profiles' },
      { status: 500 }
    );
  }
}

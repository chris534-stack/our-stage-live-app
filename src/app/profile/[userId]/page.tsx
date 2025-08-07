
import { notFound } from 'next/navigation';
import { getOrCreateUserProfile, getReviewsByUserId } from '@/lib/data';
import ProfileClientPage from '@/components/profile/ProfileClientPage';
import { Suspense } from 'react';
import ProfileLoading from './loading';
import type { Review, UserProfile } from '@/lib/types';


export default async function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  try {
    const profile = await getOrCreateUserProfile(userId);
    
    if (!profile) {
      // This is the critical fix. When notFound() is called, it throws an error
      // that Next.js catches to render the 404 page. Nothing after this line will execute.
      notFound();
    }

    // This code below will now ONLY run if a valid profile was found.
    const reviewsData = await getReviewsByUserId(userId);
    
    // Ensure reviews are properly serializable - following the Review type definition
    const serializableReviews = reviewsData.map(review => ({
      id: review.id || '',
      showId: review.showId || '',
      showTitle: review.showTitle || '',
      performanceDate: review.performanceDate || '',
      reviewerId: review.reviewerId || '',
      reviewerName: review.reviewerName || '',
      createdAt: review.createdAt || '',
      overallExperience: review.overallExperience || '',
      specialMomentsText: review.specialMomentsText || '',
      recommendations: Array.isArray(review.recommendations) ? review.recommendations : [],
      showHeartText: review.showHeartText || '',
      communityImpactText: review.communityImpactText || '',
      ticketInfo: review.ticketInfo || '',
      valueConsiderationText: review.valueConsiderationText || '',
      timeWellSpentText: review.timeWellSpentText || '',
      likes: typeof review.likes === 'number' ? review.likes : 0,
      dislikes: typeof review.dislikes === 'number' ? review.dislikes : 0,
      votedBy: Array.isArray(review.votedBy) ? review.votedBy : [],
      disclosureText: review.disclosureText || ''
    }));

    // Manually construct a plain, serializable profile object to pass to the client.
    // This is a safeguard to ensure no complex objects like Dates are passed.
    let serializableProfile: UserProfile = {
        userId: profile.userId,
        displayName: profile.displayName || 'New User',
        photoURL: profile.photoURL || '',
        email: profile.email || '',
        bio: profile.bio || '',
        roleInCommunity: profile.roleInCommunity || 'Audience',
        communityStartDate: profile.communityStartDate || '',
        galleryImageUrls: profile.galleryImageUrls || [],
        coverPhotoUrl: profile.coverPhotoUrl || '',
        showEmail: profile.showEmail || false,
        authStatus: profile.authStatus || 'active',
    };

    // --- START MOCK DATA DIAGNOSTIC ---
    const MOCK_USER_ID = "mock-user-id-123";
    const mockSerializableProfile: UserProfile = {
      userId: MOCK_USER_ID,
      displayName: 'Mock User',
      photoURL: 'https://placehold.co/200x200.png?text=MockPF',
      email: 'mock@example.com',
      bio: 'This is a mock bio for testing purposes.',
      roleInCommunity: 'Audience',
      communityStartDate: '2023',
      galleryImageUrls: [
        'https://placehold.co/400x400.png?text=Gallery1',
        'https://placehold.co/400x400.png?text=Gallery2',
      ],
      coverPhotoUrl: 'https://placehold.co/1600x400.png?text=MockCover',
      showEmail: true,
      authStatus: 'active',
    };

    const mockSerializableReviews: Review[] = [
      {
        id: 'mock-review-1',
        showId: 'mock-show-1',
        showTitle: 'Mock Show Title 1',
        performanceDate: new Date().toISOString(),
        reviewerId: MOCK_USER_ID,
        reviewerName: 'Mock User',
        createdAt: new Date().toISOString(),
        overallExperience: 'Exceptional & Memorable',
        specialMomentsText: 'Mock special moments.',
        recommendations: ['Mock Rec 1'],
        showHeartText: 'Mock show heart.',
        communityImpactText: 'Mock community impact.',
        ticketInfo: 'Mock ticket info.',
        valueConsiderationText: 'Mock value consideration.',
        timeWellSpentText: 'Mock time well spent.',
        likes: 10,
        dislikes: 0,
        votedBy: [],
        disclosureText: '',
      },
    ];

    // UNCOMMENT THE LINES BELOW TO USE MOCK DATA
    // serializableProfile = mockSerializableProfile;
    // let reviewsToUse = mockSerializableReviews;
    // console.log("USING MOCK DATA FOR PROFILE PAGE DIAGNOSTIC");


    // To use actual reviews but mock profile, uncomment below:
    // serializableProfile = mockSerializableProfile;
    // let reviewsToUse = serializableReviews;
    // console.log("USING MOCK PROFILE DATA, REAL REVIEWS FOR PROFILE PAGE DIAGNOSTIC");

    // To use actual profile but mock reviews, uncomment below:
    // let reviewsToUse = mockSerializableReviews;
    // console.log("USING REAL PROFILE DATA, MOCK REVIEWS FOR PROFILE PAGE DIAGNOSTIC");

    // To use actual data for both (normal operation):
    let reviewsToUse = serializableReviews;
    // --- END MOCK DATA DIAGNOSTIC ---


    return (
      <Suspense fallback={<ProfileLoading />}>
        {/* Ensure you use reviewsToUse if you are testing with mock reviews */}
        <ProfileClientPage initialProfile={serializableProfile} initialReviews={reviewsToUse} />
      </Suspense>
    );
  } catch (error) {
    console.error('Error rendering ProfilePage:', error);
    throw error; // Let Next.js error boundary handle it
  }
}

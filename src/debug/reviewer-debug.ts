import { adminDb } from '../lib/firebase-admin';
import type { UserProfile } from '../lib/types';

// Simple inline version of safeToISOString
function safeToISOString(dateValue: any): string {
    if (!dateValue) return new Date().toISOString();
    if (typeof dateValue === 'string') return dateValue;
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toISOString();
    }
    if (dateValue instanceof Date) return dateValue.toISOString();
    return new Date(dateValue).toISOString();
}

async function debugReviewerQuery() {
    console.log('=== REVIEWER DEBUG SCRIPT ===');
    
    try {
        // First, let's get ALL user profiles to see what we have
        console.log('\n1. Getting ALL user profiles...');
        const allProfilesSnapshot = await adminDb.collection('userProfiles').get();
        console.log(`Found ${allProfilesSnapshot.docs.length} total user profiles`);
        
        allProfilesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- User ${doc.id}: displayName="${data.displayName}", isReviewer=${data.isReviewer} (type: ${typeof data.isReviewer})`);
        });
        
        // Now let's try the exact query from getAllReviewers
        console.log('\n2. Testing isReviewer == true query...');
        const reviewerQuery = await adminDb.collection('userProfiles')
            .where('isReviewer', '==', true)
            .get();
        console.log(`Query for isReviewer == true returned ${reviewerQuery.docs.length} documents`);
        
        reviewerQuery.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- Reviewer ${doc.id}: displayName="${data.displayName}", isReviewer=${data.isReviewer}`);
        });
        
        // Now let's simulate the exact getAllReviewers logic
        console.log('\n3. Simulating getAllReviewers logic...');
        
        const reviewers = reviewerQuery.docs.map(doc => {
            const data = doc.data();
            console.log(`Processing reviewer ${doc.id}...`);
            return {
                userId: doc.id,
                displayName: data.displayName || '',
                photoURL: data.photoURL || '',
                email: data.email || '',
                bio: data.bio,
                roleInCommunity: data.roleInCommunity,
                communityStartDate: data.communityStartDate,
                galleryImageUrls: data.galleryImageUrls || [],
                coverPhotoUrl: data.coverPhotoUrl,
                showEmail: data.showEmail,
                authStatus: data.authStatus,
                isReviewer: data.isReviewer,
                reviewCount: 0,
                lastReviewDate: undefined
            } as UserProfile & { reviewCount: number; lastReviewDate?: string };
        });
        
        console.log(`Created ${reviewers.length} reviewer objects`);
        
        // Test the review count fetching for each reviewer
        console.log('\n4. Testing review count fetching...');
        for (const reviewer of reviewers) {
            try {
                console.log(`Fetching reviews for ${reviewer.displayName} (${reviewer.userId})...`);
                const reviewsSnapshot = await adminDb.collection('reviews')
                    .where('reviewerId', '==', reviewer.userId)
                    .orderBy('createdAt', 'desc')
                    .get();
                
                reviewer.reviewCount = reviewsSnapshot.docs.length;
                console.log(`- Found ${reviewer.reviewCount} reviews`);
                
                if (reviewsSnapshot.docs.length > 0) {
                    const lastReview = reviewsSnapshot.docs[0].data();
                    reviewer.lastReviewDate = safeToISOString(lastReview.createdAt);
                    console.log(`- Last review date: ${reviewer.lastReviewDate}`);
                }
            } catch (reviewError) {
                console.error(`ERROR fetching reviews for ${reviewer.displayName}:`, reviewError);
                // This might be where the function is failing!
            }
        }
        
        console.log('\n5. Final reviewer list:');
        reviewers.forEach(reviewer => {
            console.log(`- ${reviewer.displayName}: ${reviewer.reviewCount} reviews, isReviewer: ${reviewer.isReviewer}`);
        });
        
        // Let's also check the reviewerRequests collection to see approved reviewers
        console.log('\n6. Checking reviewerRequests collection...');
        const approvedRequestsSnapshot = await adminDb.collection('reviewerRequests')
            .where('status', '==', 'approved')
            .get();
        console.log(`Found ${approvedRequestsSnapshot.docs.length} approved reviewer requests`);
        
        approvedRequestsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- Approved request ${doc.id}: userId="${data.userId}", userName="${data.userName}"`);
        });
        
    } catch (error) {
        console.error('Error in debug script:', error);
    }
}

// Export for use in API route
export { debugReviewerQuery };

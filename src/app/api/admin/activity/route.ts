import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

interface ActivityItem {
  id: string;
  type: 'review_created' | 'reviewer_joined' | 'application_approved' | 'invitation_sent' | 'invitation_accepted';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  metadata?: {
    eventTitle?: string;
    reviewRating?: number;
    invitationEmail?: string;
  };
}

export async function GET() {
  try {
    const activities: ActivityItem[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch recent reviews (review_created)
    const reviewsSnapshot = await adminDb.collection('reviews')
      .where('createdAt', '>=', thirtyDaysAgo.toISOString())
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    for (const doc of reviewsSnapshot.docs) {
      const review = doc.data();
      activities.push({
        id: `review_${doc.id}`,
        type: 'review_created',
        title: 'New Review Posted',
        description: `${review.reviewerName} reviewed "${review.showTitle}"`,
        timestamp: review.createdAt,
        user: {
          name: review.reviewerName || 'Anonymous',
          email: '', // We don't store email in reviews for privacy
        },
        metadata: {
          eventTitle: review.showTitle,
          reviewRating: review.overallExperience === 'Exceptional & Memorable' ? 5 :
                       review.overallExperience === 'Great' ? 4 :
                       review.overallExperience === 'Good' ? 3 :
                       review.overallExperience === 'Okay' ? 2 : 1
        }
      });
    }

    // Fetch recent reviewer applications (application_approved)
    // Remove orderBy to avoid composite index requirement
    const applicationsSnapshot = await adminDb.collection('reviewerRequests')
      .where('status', '==', 'approved')
      .limit(20)
      .get();

    // Sort applications in memory and filter by date
    const sortedApplications = applicationsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data };
      })
      .filter((app: any) => {
        const createdAt = new Date(app.createdAt);
        return createdAt >= thirtyDaysAgo;
      })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const application of sortedApplications) {
      const app = application as any;
      activities.push({
        id: `application_${app.id}`,
        type: 'application_approved',
        title: 'Application Approved',
        description: `${app.userName}'s reviewer application was approved`,
        timestamp: app.createdAt,
        user: {
          name: app.userName || 'Unknown',
          email: app.userEmail || '',
        }
      });
    }

    // Fetch recent reviewer invitations (invitation_sent, invitation_accepted)
    // Remove orderBy to avoid potential index issues
    const invitationsSnapshot = await adminDb.collection('reviewerInvitations')
      .limit(20)
      .get();

    for (const doc of invitationsSnapshot.docs) {
      const invitation = doc.data();
      const createdAt = new Date(invitation.createdAt);
      
      if (createdAt >= thirtyDaysAgo) {
        // Invitation sent activity
        activities.push({
          id: `invitation_sent_${doc.id}`,
          type: 'invitation_sent',
          title: 'Invitation Sent',
          description: `Reviewer invitation sent to ${invitation.email}`,
          timestamp: invitation.createdAt,
          metadata: {
            invitationEmail: invitation.email
          }
        });

        // Invitation accepted activity (if accepted)
        if (invitation.status === 'accepted' && invitation.usedAt) {
          const usedAt = new Date(invitation.usedAt);
          if (usedAt >= thirtyDaysAgo) {
            // Try to get the user's name who accepted
            let acceptedUserName = 'Unknown User';
            if (invitation.acceptedByUserId) {
              try {
                const userProfileDoc = await adminDb.collection('userProfiles')
                  .doc(invitation.acceptedByUserId)
                  .get();
                if (userProfileDoc.exists) {
                  const userData = userProfileDoc.data();
                  acceptedUserName = userData?.displayName || 'Unknown User';
                }
              } catch (error) {
                console.error('Error fetching user profile for accepted invitation:', error);
              }
            }

            activities.push({
              id: `invitation_accepted_${doc.id}`,
              type: 'invitation_accepted',
              title: 'Invitation Accepted',
              description: `${acceptedUserName} accepted reviewer invitation`,
              timestamp: invitation.usedAt,
              user: {
                name: acceptedUserName,
                email: invitation.email,
              }
            });
          }
        }
      }
    }

    // Fetch recent reviewer joins (reviewer_joined) - users who became reviewers
    const recentReviewersSnapshot = await adminDb.collection('userProfiles')
      .where('isReviewer', '==', true)
      .limit(20)
      .get();

    for (const doc of recentReviewersSnapshot.docs) {
      const profile = doc.data();
      // We'll use a heuristic: if they have reviews, use their first review date as "join" date
      // Otherwise, we can't determine when they became a reviewer from profile data alone
      try {
        const userReviewsSnapshot = await adminDb.collection('reviews')
          .where('reviewerId', '==', doc.id)
          .orderBy('createdAt', 'asc')
          .limit(1)
          .get();

        if (!userReviewsSnapshot.empty) {
          const firstReview = userReviewsSnapshot.docs[0].data();
          const joinDate = new Date(firstReview.createdAt);
          
          if (joinDate >= thirtyDaysAgo) {
            activities.push({
              id: `reviewer_joined_${doc.id}`,
              type: 'reviewer_joined',
              title: 'New Reviewer Joined',
              description: `${profile.displayName || 'Unknown'} joined as a reviewer`,
              timestamp: firstReview.createdAt,
              user: {
                name: profile.displayName || 'Unknown',
                email: profile.email || '',
                avatar: profile.photoURL
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching first review for user ${doc.id}:`, error);
      }
    }

    // Sort all activities by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit to most recent 50 activities
    const recentActivities = activities.slice(0, 50);

    // Calculate monthly summary stats
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyStats = {
      newReviews: activities.filter(a => 
        a.type === 'review_created' && 
        new Date(a.timestamp) >= thisMonth
      ).length,
      newReviewers: activities.filter(a => 
        (a.type === 'reviewer_joined' || a.type === 'invitation_accepted') && 
        new Date(a.timestamp) >= thisMonth
      ).length,
      applications: activities.filter(a => 
        a.type === 'application_approved' && 
        new Date(a.timestamp) >= thisMonth
      ).length,
      invitations: activities.filter(a => 
        a.type === 'invitation_sent' && 
        new Date(a.timestamp) >= thisMonth
      ).length
    };

    return NextResponse.json({
      activities: recentActivities,
      monthlyStats
    });

  } catch (error) {
    console.error('Error fetching activity data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity data' },
      { status: 500 }
    );
  }
}

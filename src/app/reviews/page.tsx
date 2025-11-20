import { getAllReviews, getEventsByStatus } from '@/lib/data';
import type { Review, Event } from '@/lib/types';
import { BecomeReviewerCTA } from '@/components/reviews/BecomeReviewerCTA';
import { ReviewCarousel } from '@/components/reviews/ReviewCarousel';
import { toTitleCase } from '@/lib/utils';
import { startOfToday } from 'date-fns';

type GroupedReviews = {
    [showId: string]: {
        showTitle: string;
        reviews: Review[];
    }
}

function groupReviewsByShow(reviews: Review[], events: Event[]): GroupedReviews {
    const eventMap = new Map<string, string>(events.map(e => [e.id, e.title]));
    const grouped: GroupedReviews = {};

    reviews.forEach(review => {
        // Only include reviews for shows that are in the approved events list
        if (!eventMap.has(review.showId)) {
            return;
        }
        if (!grouped[review.showId]) {
            const showTitle = eventMap.get(review.showId);
            if (!showTitle) return; // Safety check
            
            grouped[review.showId] = {
                showTitle: toTitleCase(showTitle),
                reviews: []
            };
        }
        grouped[review.showId].reviews.push(review);
    });
    
    // Sort reviews within each group by likes
    for (const showId in grouped) {
        grouped[showId].reviews.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }

    return grouped;
}

// Helper function to find a suitable event for the mock review
function findEventForMockReview(events: Event[]): Event | null {
    const today = startOfToday();
    return events.find(e => 
        e.status === 'approved' &&
        e.type.toLowerCase() !== 'audition' &&
        e.occurrences?.length > 0 &&
        new Date(`${e.occurrences[e.occurrences.length - 1].date}T23:59:59`) < today
    ) || null;
}

// Helper function to create the mock review
function createMockReview(event: Event): Review {
     const performanceDate = event.occurrences?.[0]?.date || new Date().toISOString().split('T')[0];
     return {
        id: 'mock-review-1',
        showId: event.id,
        showTitle: event.title,
        performanceDate: performanceDate,
        reviewerId: 'mock-user-id',
        reviewerName: 'Casey Critic',
        createdAt: new Date().toISOString(),
        overallExperience: "Exceptional & Memorable",
        specialMomentsText: "The lead's performance in the second act was breathtaking. A true masterclass in acting that left the entire audience speechless. The rock score was performed with incredible energy by the band, and the lighting design perfectly captured the show's dark, intense mood.",
        recommendations: ["Date Night", "Dramatic", "Musical"],
        showHeartText: "This was a profound exploration of a historical figure through a modern rock lens. It was challenging, but ultimately very rewarding.",
        communityImpactText: "A story like this is exactly what Eugene needs right now. It opens up important conversations and showcases incredible local talent.",
        ticketInfo: "Paid $35 for a seat in the mezzanine, Row E. The view was excellent for the price.",
        valueConsiderationText: "For the price of a movie ticket and popcorn, you get a live experience that will stick with you for weeks. The production value was outstanding and felt like a bargain.",
        timeWellSpentText: "Absolutely. The show was engaging from start to finish. I'd recommend it to anyone looking for a powerful night of theatre.",
        disclosureText: "I attended this performance as a regular audience member and purchased my own ticket.",
        likes: 12,
        dislikes: 1,
        votedBy: [],
    };
}

// Helper function to create second mock review
function createSecondMockReview(event: Event): Review {
     const performanceDate = event.occurrences?.[1]?.date || event.occurrences?.[0]?.date || new Date().toISOString().split('T')[0];
     return {
        id: 'mock-review-2',
        showId: event.id,
        showTitle: event.title,
        performanceDate: performanceDate,
        reviewerId: 'mock-user-id-2',
        reviewerName: 'Alex Theatre',
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        overallExperience: "Good & Enjoyable",
        specialMomentsText: "The choreography was well-executed and the ensemble cast worked beautifully together. Some technical issues with the sound system in the first act, but overall a solid production that showcased local talent effectively.",
        recommendations: ["Family Friendly", "Musical", "Community"],
        showHeartText: "A heartwarming story that resonates with our community. The local references and humor made it feel very Eugene.",
        communityImpactText: "Great to see our local theatre scene producing original work. This kind of production brings people together.",
        ticketInfo: "Paid $28 for orchestra seating. Good value for a local production.",
        valueConsiderationText: "Reasonable pricing for the quality of production. Supporting local theatre is always worthwhile.",
        timeWellSpentText: "Yes, an enjoyable evening out. Would recommend to friends looking for local entertainment.",
        disclosureText: "I purchased my ticket through the box office and have no affiliation with the production.",
        likes: 8,
        dislikes: 0,
        votedBy: [],
    };
}

// Helper function to create third mock review
function createThirdMockReview(event: Event): Review {
     const performanceDate = event.occurrences?.[2]?.date || event.occurrences?.[0]?.date || new Date().toISOString().split('T')[0];
     return {
        id: 'mock-review-3',
        showId: event.id,
        showTitle: event.title,
        performanceDate: performanceDate,
        reviewerId: 'mock-user-id-3',
        reviewerName: 'Jordan Playgoer',
        createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        overallExperience: "Mixed Feelings",
        specialMomentsText: "Some brilliant moments, particularly in the second half. The lead actor really found their stride after intermission. However, pacing issues in the first act made it feel longer than necessary.",
        recommendations: ["Dramatic", "Thought-Provoking"],
        showHeartText: "An ambitious piece that doesn't quite hit all its marks but shows real potential. The themes are relevant and important.",
        communityImpactText: "Appreciate the effort to tackle difficult subjects. Not every show needs to be perfect to be meaningful.",
        ticketInfo: "Student discount ticket for $20. Fair price point for students.",
        valueConsiderationText: "At the student price, definitely worth it. Full price might be steep given some of the production issues.",
        timeWellSpentText: "Worth seeing for the second act alone. The ending really brings everything together.",
        disclosureText: "Student ticket holder, no other connection to the production.",
        likes: 5,
        dislikes: 2,
        votedBy: [],
    };
}

export default async function ReviewsPage() {
    const [allReviews, allEvents] = await Promise.all([
        getAllReviews(),
        getEventsByStatus('approved')
    ]);
    
    // If no real reviews exist, create a mock one for demonstration.
    if (allReviews.length === 0) {
        const eventForMock = findEventForMockReview(await getEventsByStatus('approved'));
        if (eventForMock) {
            allReviews.push(createMockReview(eventForMock));
        }
    }

    const groupedReviews = groupReviewsByShow(allReviews, allEvents);
    const sortedShowIds = Object.keys(groupedReviews).sort((a,b) => {
        const latestReviewA = new Date(groupedReviews[a].reviews[0].createdAt).getTime();
        const latestReviewB = new Date(groupedReviews[b].reviews[0].createdAt).getTime();
        return latestReviewB - latestReviewA;
    });

    return (
        <div className="w-full py-8 px-2 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary mb-3">Community Reviews</h1>
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                    The conversation about Eugene's theatre scene, straight from the audience.
                </p>
            </div>

            <div className="mb-16">
                <BecomeReviewerCTA />
            </div>

            <div className="space-y-12">
                {sortedShowIds.length > 0 ? (
                    sortedShowIds.map(showId => {
                        const group = groupedReviews[showId];
                        return (
                            <section key={showId}>
                                <h2 className="text-2xl md:text-3xl font-bold font-headline text-primary mb-4 text-left px-3 sm:px-0">
                                    Reviews for <span className="text-accent">{group.showTitle}</span>
                                </h2>
                                <ReviewCarousel reviews={group.reviews} />
                            </section>
                        )
                    })
                ) : (
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                         <p className="font-semibold text-lg text-muted-foreground">No Reviews Yet</p>
                         <p className="text-muted-foreground mt-2">Check back later for community thoughts on local shows!</p>
                    </div>
                )}
            </div>
        </div>
    );
}

import { getAllReviews, getEventsByStatus, getAllVenues } from '@/lib/data';
import type { Review, Event, Venue } from '@/lib/types';
import { ReviewsHeroCTA } from '@/components/reviews/ReviewsHeroCTA';
import { ShowMosaicSection } from '@/components/reviews/ShowMosaicSection';
import { toTitleCase } from '@/lib/utils';



type GroupedReviews = {
    [showId: string]: {
        showTitle: string;
        posterUrl?: string;
        venueId?: string;
        reviews: Review[];
    }
}

function groupReviewsByShow(reviews: Review[], events: Event[]): GroupedReviews {
    const eventMap = new Map<string, Event>(events.map(e => [e.id, e]));
    const grouped: GroupedReviews = {};

    reviews.forEach(review => {
        // Only include reviews for shows that are in the approved events list
        const event = eventMap.get(review.showId);
        if (!event) {
            return;
        }
        if (!grouped[review.showId]) {
            grouped[review.showId] = {
                showTitle: toTitleCase(event.title),
                posterUrl: event.posterUrl,
                venueId: event.venueId,
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



export default async function ReviewsPage() {
    const [allReviews, allEvents, allVenues] = await Promise.all([
        getAllReviews(),
        getEventsByStatus('approved'),
        getAllVenues()
    ]);

    // Create a map for venue lookups
    const venueMap = new Map<string, Venue>(allVenues.map(v => [v.id, v]));



    const groupedReviews = groupReviewsByShow(allReviews, allEvents);
    const sortedShowIds = Object.keys(groupedReviews).sort((a, b) => {
        const latestReviewA = new Date(groupedReviews[a].reviews[0].createdAt).getTime();
        const latestReviewB = new Date(groupedReviews[b].reviews[0].createdAt).getTime();
        return latestReviewB - latestReviewA;
    });

    return (
        <div className="w-full py-8 px-2 sm:px-6 lg:px-8">


            <div className="mb-16">
                <ReviewsHeroCTA />
            </div>

            <div className="space-y-16">
                {sortedShowIds.length > 0 ? (
                    sortedShowIds.map(showId => {
                        const group = groupedReviews[showId];
                        const venue = group.venueId ? venueMap.get(group.venueId) : undefined;
                        return (
                            <ShowMosaicSection
                                key={showId}
                                showId={showId}
                                showTitle={group.showTitle}
                                posterUrl={group.posterUrl}
                                venueColor={venue?.color}
                                venueName={venue?.name}
                                reviews={group.reviews}
                            />
                        );
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

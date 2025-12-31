
import { EventCalendar } from '@/components/calendar/EventCalendar';
import { getEventsByStatus, getAllVenues, getAllReviews, enrichEventsWithVenues } from '@/lib/data';
import type { Venue, ExpandedCalendarEvent, Review } from '@/lib/types';

async function getCalendarData(): Promise<{ events: ExpandedCalendarEvent[], venues: Venue[] }> {
  const [approvedEvents, allVenues, allReviews] = await Promise.all([
    getEventsByStatus('approved'),
    getAllVenues(),
    getAllReviews(),
  ]);

  const enrichedEvents = enrichEventsWithVenues(approvedEvents, allVenues);

  // Group reviews by showId for efficient lookup
  const reviewsByShowId = new Map<string, Review[]>();
  allReviews.forEach(review => {
    if (!reviewsByShowId.has(review.showId)) {
      reviewsByShowId.set(review.showId, []);
    }
    reviewsByShowId.get(review.showId)!.push(review);
  });

  const expandedEventsMap = new Map<string, ExpandedCalendarEvent>();

  enrichedEvents.forEach(event => {
    if (!event.occurrences || event.occurrences.length === 0) {
      return;
    }

    const eventReviews = reviewsByShowId.get(event.id) || [];
    const { occurrences, ...restOfEvent } = event;

    event.occurrences.forEach(occurrence => {
      const uniqueOccurrenceId = `${event.id}-${occurrence.date}-${occurrence.time || 'all-day'}`;

      if (expandedEventsMap.has(uniqueOccurrenceId)) {
        console.warn('[Calendar] Duplicate occurrence detected, skipping duplicate entry', {
          eventId: event.id,
          date: occurrence.date,
          time: occurrence.time,
        });
        return;
      }

      expandedEventsMap.set(uniqueOccurrenceId, {
        ...restOfEvent,
        uniqueOccurrenceId,
        date: occurrence.date,
        time: occurrence.time,
        reviews: eventReviews,
      });
    });
  });

  const expandedEvents = Array.from(expandedEventsMap.values());

  // Sort all occurrences chronologically for the event list view
  expandedEvents.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
    const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
    return dateA.getTime() - dateB.getTime();
  });

  return { events: expandedEvents, venues: allVenues };
}

export default async function CalendarPage() {
  const { events, venues } = await getCalendarData();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 md:py-8">
      <EventCalendar events={events} venues={venues} />
    </div>
  );
}

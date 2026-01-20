
import { EventCalendar } from '@/components/calendar/EventCalendar';
import { getEventsByStatus, getAllVenues, getAllReviews, enrichEventsWithVenues } from '@/lib/data';
import type { Venue, ExpandedCalendarEvent, Review } from '@/lib/types';
import { CalendarDays, Sparkles, Ticket, Theater } from 'lucide-react';

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
    <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
      {/* Compact Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/95 via-primary to-primary/85 p-6 md:p-8 text-primary-foreground mb-6 max-w-7xl mx-auto">
        {/* Decorative floating elements */}
        <div className="absolute top-3 right-6 opacity-20 animate-subtle-breathe">
          <CalendarDays className="h-12 w-12 md:h-16 md:w-16" />
        </div>
        {/* Moved from bottom-left to top-center/left to avoid text overlap */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 opacity-10 animate-subtle-breathe delay-500">
          <Ticket className="h-24 w-24 md:h-32 md:w-32" />
        </div>

        {/* Blurred accent orbs */}
        <div className="absolute -top-8 -left-8 w-32 h-32 bg-accent/25 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-accent/20 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              <span>Eugene Theatre Scene</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-headline">
              Community Calendar
            </h1>
            <p className="text-primary-foreground/80 text-sm md:text-base max-w-xl">
              Discover performances, auditions, and workshops happening across Eugene.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
            <Theater className="h-4 w-4" />
            <span>{venues.length} venues</span>
            <span className="mx-2">•</span>
            <Ticket className="h-4 w-4" />
            <span>{events.length} upcoming events</span>
          </div>
        </div>
      </div>

      {/* Calendar Component */}
      <div className="max-w-7xl mx-auto">
        <EventCalendar events={events} venues={venues} />
      </div>
    </div>
  );
}

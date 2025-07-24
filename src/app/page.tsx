import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getFeaturedEventsFirestore, getAllVenues } from '@/lib/data';
import type { Event, Venue } from '@/lib/types';
import { ExpandableEventTile } from '@/components/home/ExpandableEventTile';

type EventWithVenue = Event & { venue?: Venue };

async function getFeaturedEvents(): Promise<EventWithVenue[]> {
  const [featured, allVenues] = await Promise.all([
    getFeaturedEventsFirestore(3),
    getAllVenues()
  ]);
  
  const venuesMap = new Map<string, Venue>(allVenues.map(v => [v.id, v]));
  
  return featured.map(event => ({
    ...event,
    venue: venuesMap.get(event.venueId)
  }));
}



export default async function Home() {
  const featuredEvents = await getFeaturedEvents();

  return (
    <div className="flex flex-col">
      <section className="w-full py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-4xl rounded-2xl bg-primary p-8 md:p-12 text-center text-primary-foreground shadow-2xl">
            <div className="inline-block">
                <h1 className="text-4xl md:text-6xl font-bold font-headline mb-4 leading-tight">
                Our Stage,<br />Eugene
                </h1>
                <div className="h-1.5 bg-accent w-1/2 mx-auto"></div>
            </div>
            <p className="text-md md:text-xl text-accent max-w-2xl mx-auto my-6">
              Your one-stop resource for performances, auditions, workshops, and community connections in Eugene, Oregon.
            </p>
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-md px-10 py-6 text-lg font-bold">
              <Link href="/calendar">View Upcoming Events</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-8 md:py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary">Featured This Month</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {featuredEvents.map(event => (
              <ExpandableEventTile key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

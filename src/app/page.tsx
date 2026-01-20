import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getFeaturedEventsFirestore, getAllVenues, enrichEventsWithVenues } from '@/lib/data';
import type { Event, Venue } from '@/lib/types';
import { ExpandableEventTile } from '@/components/home/ExpandableEventTile';
import { CommunitySpotlightSection } from '@/components/home/CommunitySpotlightSection';
import { HomeHero } from '@/components/home/HomeHero';

type EventWithVenue = Event & { venue?: Venue };

// Revalidate the homepage periodically in production so Featured events stay fresh
// In development, use dynamic rendering to always show current data
// In production, rebuild the page at most every 5 minutes to ensure events stay current
export const revalidate = 300; // seconds

async function getFeaturedEvents(): Promise<EventWithVenue[]> {
  const [featured, allVenues] = await Promise.all([
    getFeaturedEventsFirestore(3),
    getAllVenues()
  ]);

  return enrichEventsWithVenues(featured, allVenues);
}



export default async function Home() {
  const featuredEvents = await getFeaturedEvents();

  return (
    <div className="w-full">
      {/* Two-column layout on xl screens: left = hero + featured, right = spotlight */}
      <div className="mx-auto w-full max-w-screen-2xl px-4 md:px-6 xl:grid xl:grid-cols-[minmax(0,1fr)_520px] 2xl:grid-cols-[minmax(0,1fr)_600px] xl:gap-10">
        {/* Left column */}
        <div className="flex flex-col">
          <section className="w-full py-8 md:py-12">
            {/* Modern hero with gradient and decorative elements */}
            <div className="mx-auto max-w-4xl">
              <HomeHero />
            </div>
          </section>

          <section className="py-8 md:py-12 bg-background">
            {/* Remove nested container; left column already padded */}
            <div className="mx-auto">
              <div className="text-center mb-8 md:mb-12">
                <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary">Featured This Month</h2>
              </div>

              {/* Mobile: Horizontal scroll */}
              <div className="md:hidden">
                <div className="flex gap-4 overflow-x-auto pb-4 px-2 scrollbar-hide">
                  {featuredEvents.map(event => (
                    <div key={event.id} className="flex-shrink-0">
                      <ExpandableEventTile event={event} />
                    </div>
                  ))}
                </div>
                <div className="text-center mt-4">
                  <p className="text-sm text-muted-foreground">Swipe to see more events</p>
                </div>
              </div>

              {/* Desktop: Left-align tiles */}
              <div className="hidden md:flex flex-wrap justify-center gap-8">
                {featuredEvents.map(event => (
                  <ExpandableEventTile key={event.id} event={event} />
                ))}
              </div>
            </div>
          </section>

          {/* Spotlight for smaller screens (stacked below content) */}
          <section className="py-6 md:py-8 xl:hidden">
            <div className="mx-auto">
              <div className="grid grid-cols-1 gap-6 md:gap-8 items-stretch">
                <div>
                  <CommunitySpotlightSection />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right column (desktop only) */}
        <div className="hidden xl:block pt-8 md:pt-12">
          <CommunitySpotlightSection variant="sidebar" />
        </div>
      </div>
    </div>
  );
}

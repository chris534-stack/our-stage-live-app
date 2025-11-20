'use client';
import { useEffect, useState } from 'react';
import { ResponsiveAdminLayout, type AdminSection } from '@/components/admin/ResponsiveAdminLayout';
import { ResponsiveEventManager } from '@/components/admin/ResponsiveEventManager';
import { VenueManager } from '@/components/admin/VenueManager';
import { ScraperForm } from '@/components/admin/ScraperForm';
import { UsersDirectory } from '@/components/admin/UsersDirectory';
import { ReviewerHub } from '@/components/admin/ReviewerHub';
import { CommunitySpotlights } from '@/components/admin/CommunitySpotlights';
import { Analytics } from '@/components/admin/Analytics';
import { SimplifiedDebugDashboard } from '@/components/debug/SimplifiedDebugDashboard';
import { VenueRepInvitations } from '@/components/admin/VenueRepInvitations';
import { ActiveVenueReps } from '@/components/admin/ActiveVenueReps';
import type { Event, Venue } from '@/lib/types';
import type { EventWithCreator } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter, useSearchParams } from 'next/navigation';

type EventWithVenueAndCreator = Event & { venue?: Venue } & EventWithCreator;

export default function AdminDashboard({ initialEvents, venues }: { initialEvents: EventWithVenueAndCreator[], venues: Venue[] }) {
  const [activeSection, setActiveSection] = useState<AdminSection>('events');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Keep active section in sync with ?section=
  useEffect(() => {
    const section = searchParams.get('section') as AdminSection | null;
    const valid: AdminSection[] = ['events','venues','scraper','users','reviewers','spotlights','analytics','venueReps','debug'];
    if (section && valid.includes(section) && section !== activeSection) {
      setActiveSection(section);
    }
  }, [searchParams, activeSection]);

  const autoOpenInvite = searchParams.get('invite') === '1';

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'events':
        return <ResponsiveEventManager events={initialEvents} venues={venues} />;
      
      case 'venues':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-headline mb-2">Venue Management</h2>
              <p className="text-muted-foreground">Manage theatre venues and locations</p>
            </div>
            <VenueManager venues={venues} />
          </div>
        );
      
      case 'scraper':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-headline mb-2">Web Scraper</h2>
              <p className="text-muted-foreground">Automatically extract event information from websites</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Automated Event Scraper</CardTitle>
                <CardDescription>
                  Provide a URL and/or upload a screenshot of the page. The AI will pre-fill an event form for you to review and submit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScraperForm venues={venues} />
              </CardContent>
            </Card>
          </div>
        );
      
      case 'users':
        return <UsersDirectory />;
      
      case 'reviewers':
        return <ReviewerHub />;
      
      case 'venueReps':
        return (
          <div className="space-y-6">
            <ActiveVenueReps venues={venues} />
            <VenueRepInvitations venues={venues} autoOpenInvite={autoOpenInvite} hideInviteButton />
          </div>
        );
      
      case 'spotlights':
        return <CommunitySpotlights />;
      
      case 'analytics':
        return <Analytics />;
      
      case 'debug':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-headline mb-2">Debug Tools</h2>
              <p className="text-muted-foreground">Comprehensive debugging and monitoring for the reviewer invitation pipeline</p>
            </div>
            <SimplifiedDebugDashboard />
          </div>
        );
      
      default:
        return <ResponsiveEventManager events={initialEvents} venues={venues} />;
    }
  };

  return (
    <ResponsiveAdminLayout
      activeSection={activeSection}
      onSectionChange={(s) => {
        setActiveSection(s);
        // keep URL in sync and clear invite param unless explicitly set later
        const url = new URL(window.location.href);
        url.searchParams.set('section', s);
        url.searchParams.delete('invite');
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      }}
    >
      {renderSectionContent()}
    </ResponsiveAdminLayout>
  );
}

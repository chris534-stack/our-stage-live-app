'use client';

import { useState } from 'react';
import { ResponsiveAdminLayout, type AdminSection } from '@/components/admin/ResponsiveAdminLayout';
import { ResponsiveEventManager } from '@/components/admin/ResponsiveEventManager';
import { VenueManager } from '@/components/admin/VenueManager';
import { ScraperForm } from '@/components/admin/ScraperForm';
import { UsersDirectory } from '@/components/admin/UsersDirectory';
import { ReviewerHub } from '@/components/admin/ReviewerHub';
import { CommunitySpotlights } from '@/components/admin/CommunitySpotlights';
import { Analytics } from '@/components/admin/Analytics';
import { SimplifiedDebugDashboard } from '@/components/debug/SimplifiedDebugDashboard';
import type { Event, Venue } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type EventWithVenue = Event & { venue?: Venue };

export default function AdminDashboard({ initialEvents, venues }: { initialEvents: EventWithVenue[], venues: Venue[] }) {
  const [activeSection, setActiveSection] = useState<AdminSection>('events');

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
      onSectionChange={setActiveSection}
    >
      {renderSectionContent()}
    </ResponsiveAdminLayout>
  );
}

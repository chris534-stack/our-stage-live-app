'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventTable } from '@/components/admin/EventTable';
import { MobileEventCard } from '@/components/admin/MobileEventCard';
import type { Event, Venue } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

type EventWithVenue = Event & { venue?: Venue };

interface ResponsiveEventManagerProps {
  events: EventWithVenue[];
  venues: Venue[];
}

export function ResponsiveEventManager({ events, venues }: ResponsiveEventManagerProps) {
  const pendingEvents = events.filter(e => e.status === 'pending');
  const approvedEvents = events.filter(e => e.status === 'approved');
  const deniedEvents = events.filter(e => e.status === 'denied');

  const EventsContent = ({ eventList, emptyMessage }: { eventList: EventWithVenue[], emptyMessage: string }) => (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <EventTable events={eventList} venues={venues} />
      </div>
      
      {/* Mobile Card View */}
      <div className="md:hidden">
        {eventList.length > 0 ? (
          <div className="space-y-4">
            {eventList.map((event) => (
              <MobileEventCard key={event.id} event={event} venues={venues} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-headline mb-2">Event Reviews</h2>
        <p className="text-muted-foreground">Review and manage submitted events</p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        {/* Desktop Tabs */}
        <TabsList className="hidden md:grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pending Review
            {pendingEvents.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingEvents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            Approved
            {approvedEvents.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {approvedEvents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="denied" className="flex items-center gap-2">
            Denied
            {deniedEvents.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {deniedEvents.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Mobile Tabs - Scrollable */}
        <div className="md:hidden">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="pending" className="flex items-center gap-1 whitespace-nowrap">
              Pending
              {pendingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {pendingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-1 whitespace-nowrap">
              Approved
              {approvedEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {approvedEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="denied" className="flex items-center gap-1 whitespace-nowrap">
              Denied
              {deniedEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {deniedEvents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="mt-6">
          <EventsContent 
            eventList={pendingEvents} 
            emptyMessage="No events pending review" 
          />
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          <EventsContent 
            eventList={approvedEvents} 
            emptyMessage="No approved events" 
          />
        </TabsContent>

        <TabsContent value="denied" className="mt-6">
          <EventsContent 
            eventList={deniedEvents} 
            emptyMessage="No denied events" 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

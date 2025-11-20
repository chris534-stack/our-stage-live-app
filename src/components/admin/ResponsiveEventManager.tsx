'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventTable } from '@/components/admin/EventTable';
import { MobileEventCard } from '@/components/admin/MobileEventCard';
import type { Event, Venue } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Calendar, Archive, UserCheck } from 'lucide-react';
import type { EventWithCreator } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

type EventWithVenue = Event & { venue?: Venue };
type EventWithVenueAndCreator = EventWithVenue & EventWithCreator;

interface ResponsiveEventManagerProps {
  events: EventWithVenueAndCreator[];
  venues: Venue[];
}

export function ResponsiveEventManager({ events, venues }: ResponsiveEventManagerProps) {
  const router = useRouter();
  
  // Creator filter state
  const [creatorFilter, setCreatorFilter] = useState<string>('all');

  const venuesById = useMemo(() => {
    const map: Record<string, Venue> = {} as any;
    for (const v of venues) map[v.id] = v;
    return map;
  }, [venues]);

  // Unique creator list from events (handles unknown creator IDs)
  const creators = useMemo(() => {
    const map = new Map<string, { id: string; label: string; isRep: boolean }>();
    for (const e of events) {
      const id = e.createdBy && e.createdBy.trim() !== '' ? e.createdBy : '__unknown__';
      if (!map.has(id)) {
        const label = e.createdByName || e.createdByEmail || (id === '__unknown__' ? 'Unknown' : `${id.slice(0, 6)}…`);
        map.set(id, { id, label, isRep: !!e.createdByIsVenueRep });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);

  // Apply creator filter
  const filteredEvents = useMemo(() => {
    if (creatorFilter === 'all') return events;
    return events.filter(e => {
      const id = e.createdBy && e.createdBy.trim() !== '' ? e.createdBy : '__unknown__';
      return id === creatorFilter;
    });
  }, [events, creatorFilter]);

  const pendingEvents = filteredEvents.filter(e => e.status === 'pending');
  const approvedEvents = filteredEvents.filter(e => e.status === 'approved');
  const deniedEvents = filteredEvents.filter(e => e.status === 'denied');

  // Helpers for KPI calculations
  const parseDateStringLocal = (dateString: string): Date => {
    // Avoid timezone issues by constructing a local date
    const [year, month, day] = (dateString || '').split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  };

  const approvedThisMonthCount = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return filteredEvents.filter(e => e.status === 'approved' && Array.isArray(e.occurrences) && e.occurrences.some(occ => {
      if (!occ?.date) return false;
      const d = parseDateStringLocal(occ.date);
      return d.getMonth() === m && d.getFullYear() === y;
    })).length;
  }, [filteredEvents]);

  const archivedEventsCount = useMemo(() => {
    // Count events whose last occurrence is strictly before today
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return filteredEvents.filter(e => {
      const occs = Array.isArray(e.occurrences) ? e.occurrences : [];
      if (occs.length === 0) return false;
      let latest: Date | null = null;
      for (const occ of occs) {
        if (!occ?.date) continue;
        const d = parseDateStringLocal(occ.date);
        if (!latest || d > latest) latest = d;
      }
      return latest ? latest < todayMidnight : false;
    }).length;
  }, [filteredEvents]);

  // Venue Rep submissions (count of events created by users marked as venue reps)
  const repSubmissionsCount = useMemo(() => {
    return filteredEvents.filter(e => !!e.createdByIsVenueRep).length;
  }, [filteredEvents]);

  // (Removed) Local invitation fetching and dialog — use VenueRepInvitations instead

  const EventsContent = ({ eventList, emptyMessage }: { eventList: EventWithVenueAndCreator[], emptyMessage: string }) => (
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

  // (Removed) Local invite creation and actions — replaced by canonical VenueRepInvitations

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-headline mb-2">Event Reviews</h2>
        <p className="text-muted-foreground">Review and manage submitted events</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Filter by creator</Label>
          <Select value={creatorFilter} onValueChange={setCreatorFilter}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All creators" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All creators</SelectItem>
              {creators.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}{c.isRep ? ' (Rep)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Hub KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pending approvals</p>
              <p className="text-2xl font-bold">{pendingEvents.length}</p>
            </div>
            <Clock className="h-5 w-5 text-amber-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Approved this month</p>
              <p className="text-2xl font-bold">{approvedThisMonthCount}</p>
            </div>
            <Calendar className="h-5 w-5 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Rep submissions</p>
              <p className="text-2xl font-bold">{repSubmissionsCount}</p>
            </div>
            <UserCheck className="h-5 w-5 text-blue-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Archived events</p>
              <p className="text-2xl font-bold">{archivedEventsCount}</p>
            </div>
            <Archive className="h-5 w-5 text-slate-600" />
          </CardContent>
        </Card>
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

      {/* Venue Rep Invitations moved to canonical UI */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Venue Rep Invitations</h3>
            <p className="text-sm text-muted-foreground">Create and manage invitations in the Venue Representatives section.</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin?section=venueReps&invite=1')}>
            Go to Invitations
          </Button>
        </CardContent>
      </Card>

      {/* (Removed) Local invite dialog — use VenueRepInvitations */}
    </div>
  );
}

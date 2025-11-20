
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { ExpandedCalendarEvent, Venue, Event, Review } from '@/lib/types';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  isSameDay,
  isPast,
  parseISO
} from 'date-fns';
import { cn, toTitleCase } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { FilterIcon, MapPin, Ticket, ExternalLink, CalendarDays, ChevronLeft, ChevronRight, Home, X, Edit, MessageSquareQuote, MessageSquareText, Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth/AuthProvider';
import { EventEditorModal } from '@/components/admin/EventEditorModal';
import { ReviewSubmissionModal } from '@/components/reviews/ReviewSubmissionModal';
import type { DayContentProps } from 'react-day-picker';
import Link from 'next/link';
import { ReviewList } from '@/components/reviews/ReviewList';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { EventEditorForm } from '@/components/admin/EventEditorForm';
import { useSwipeable } from 'react-swipeable';

const AddEventButton = dynamic(
    () => import('@/components/admin/AddEventButton').then(mod => mod.AddEventButton),
    { ssr: false }
);

function getContrastingTextColor(color: string): string {
    if (!color) return '#ffffff';

    let r: number, g: number, b: number;

    if (color.startsWith('#')) {
        let hex = color.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        if (hex.length !== 6) return '#000000';
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else if (color.startsWith('hsl')) {
        const result = /hsl\(\s*(\d+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/.exec(color);
        if (!result) return '#000000';
        const h = parseInt(result[1]);
        const s = parseFloat(result[2]) / 100;
        const l = parseFloat(result[3]) / 100;
        
        if (s === 0) {
            r = g = b = l * 255;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h / 360 + 1 / 3) * 255;
            g = hue2rgb(p, q, h / 360) * 255;
            b = hue2rgb(p, q, h / 360 - 1 / 3) * 255;
        }
    } else {
        return '#000000'; // Fallback for named colors or other formats
    }

    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function EventCalendar({ events, venues }: { events: ExpandedCalendarEvent[], venues: Venue[] }) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [currentMonth, setCurrentMonth] = React.useState<Date | undefined>();
  const [selectedVenues, setSelectedVenues] = React.useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [isClient, setIsClient] = React.useState(false);
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
  const { user, isAdmin, isReviewer, isVenueRep, hasSeenVenueRepIntro, venueRepOnboardingCompleted, venueRepPolicyAccepted, setHasSeenVenueRepIntro, setVenueRepOnboardingCompleted } = useAuth();
  const [editingEvent, setEditingEvent] = React.useState<Event | null>(null);
  const [isReviewModalOpen, setReviewModalOpen] = React.useState(false);
  const [selectedEventForReview, setSelectedEventForReview] = React.useState<ExpandedCalendarEvent | null>(null);
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);
  const minSwipeDistance = 50;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isOnboardingOpen, setOnboardingOpen] = React.useState(false);
  const [onboardingStep, setOnboardingStep] = React.useState<number>(1);
  const [isCreateEventOpen, setCreateEventOpen] = React.useState(false);
  
  
  React.useEffect(() => {
    setIsClient(true);
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(startOfMonth(today));
  }, []);

  useEffect(() => {
    if (selectedDate) {
        // Do not set current month here if it's already set from the initial useEffect
        if (!currentMonth) {
            setCurrentMonth(startOfMonth(selectedDate));
        }
    }
  }, [selectedDate, currentMonth]);
  
  const isMobile = useIsMobile();

  // Open onboarding intro if redirected with query or user hasn't seen intro yet
  useEffect(() => {
    const onboardingParam = searchParams?.get('onboarding');
    if (isVenueRep && (!hasSeenVenueRepIntro || onboardingParam === 'venue-rep')) {
      setOnboardingOpen(true);
      setOnboardingStep(1);
      if (onboardingParam) {
        router.replace(pathname);
      }
    }
  }, [isVenueRep, hasSeenVenueRepIntro, searchParams, router, pathname]);
  
  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    events.forEach(e => {
        const eventType = e.type.trim().toLowerCase();
        if (eventType !== 'performance') {
            types.add(eventType);
        }
    });
    return Array.from(types).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (selectedEventId) {
        return events.filter(event => event.id === selectedEventId);
    }
    return events.filter(event => {
      const venueMatch = selectedVenues.length === 0 || selectedVenues.includes(event.venueId);
      const typeMatch = selectedTypes.length === 0 || selectedTypes.includes(event.type.trim().toLowerCase());
      return venueMatch && typeMatch;
    });
  }, [events, selectedVenues, selectedTypes, selectedEventId]);
  
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ExpandedCalendarEvent[]>();
    filteredEvents.forEach(event => {
      const dateKey = event.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [filteredEvents]);
  
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return eventsByDate.get(dateString) || [];
  }, [selectedDate, eventsByDate]);

  

  const handleVenueToggle = (venueId: string) => {
    setSelectedVenues(prev => 
      prev.includes(venueId) ? prev.filter(id => id !== venueId) : [...prev, venueId]
    );
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };
  
  

  const handleCardClick = (eventId: string) => {
    setSelectedEventId(prevId => (prevId === eventId ? null : eventId));
  };

  const isOccurrenceInPast = (event: ExpandedCalendarEvent): boolean => {
    const dateTimeString = `${event.date}T${event.time || '23:59:59'}`;
    try {
        const eventDateTime = parseISO(dateTimeString);
        return isPast(eventDateTime);
    } catch {
        return false;
    }
  }

  const isReviewableEventType = (eventType: string) => {
    const nonReviewableTypes = ['audition', 'workshop'];
    return !nonReviewableTypes.includes(eventType.trim().toLowerCase());
  }
  
  const handleEditClick = (selectedOccurrence: ExpandedCalendarEvent) => {
    const allOccurrencesForEvent = events
        .filter(e => e.id === selectedOccurrence.id)
        .map(e => ({ date: e.date, time: e.time }))
        .filter((occ, index, self) => 
            index === self.findIndex(o => o.date === occ.date && o.time === occ.time)
        )
        .sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
            const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
            return dateA.getTime() - dateB.getTime();
        });
    
    const fullEvent: Event = {
        id: selectedOccurrence.id,
        title: selectedOccurrence.title,
        description: selectedOccurrence.description,
        url: selectedOccurrence.url,
        venueId: selectedOccurrence.venueId,
        type: selectedOccurrence.type,
        tags: selectedOccurrence.tags,
        status: selectedOccurrence.status,
        createdBy: selectedOccurrence.createdBy,
        occurrences: allOccurrencesForEvent,
    };
    setEditingEvent(fullEvent);
  };

  const handleLeaveReviewClick = (event: ExpandedCalendarEvent) => {
    setSelectedEventForReview(event);
    setReviewModalOpen(true);
  };

  const calendarDays = useMemo(() => {
    if (!currentMonth) return [];
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);
  
  const weekDayNames = useMemo(() => {
    const start = startOfWeek(new Date());
    return eachDayOfInterval({ start, end: endOfWeek(new Date()) }).map(d => format(d, 'EE'));
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset touch end on new touch start
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !currentMonth) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentMonth(addMonths(currentMonth, 1));
    } else if (isRightSwipe) {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
    
    // Reset touch coordinates
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  }

  // Swipe gesture handlers for month navigation
  const monthSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentMonth) {
        handleMonthChange(addMonths(currentMonth, 1));
      }
    },
    onSwipedRight: () => {
      if (currentMonth) {
        handleMonthChange(subMonths(currentMonth, 1));
      }
    },
    trackMouse: false, // Only track touch events on mobile
    preventScrollOnSwipe: true,
    trackTouch: true,
  });

  if (!isClient || !currentMonth) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-full lg:max-w-none">
        <div className="lg:col-span-2">
          <Skeleton className="w-full h-full min-h-[720px]" />
        </div>
        <div className="lg:col-span-1">
          <Skeleton className="w-full h-full min-h-[80vh]" />
        </div>
      </div>
    )
  }

  const DesktopCalendar = () => (
    <Card className="h-full flex flex-col min-h-[720px]" {...monthSwipeHandlers}>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="font-headline text-2xl">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleMonthChange(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleMonthChange(startOfMonth(new Date()))}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => handleMonthChange(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <div className="grid grid-cols-7 border-t border-b text-center text-sm font-semibold text-muted-foreground">
        {weekDayNames.map(day => <div key={day} className="py-2">{day}</div>)}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1 gap-px bg-border" data-tour="calendar-grid">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDate.get(dateKey) || [];
          return (
            <div
              key={day.toString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                'p-2 bg-background hover:bg-muted/50 cursor-pointer flex flex-col overflow-hidden',
                !isSameMonth(day, currentMonth) && 'bg-muted/30 text-muted-foreground',
                isSameDay(day, selectedDate || new Date(0)) && 'bg-primary/10 ring-2 ring-primary z-10'
              )}
            >
              <span className={cn(
                'font-medium self-start',
                isToday(day) && 'bg-accent text-accent-foreground rounded-full h-6 w-6 flex items-center justify-center',
                isSameDay(day, selectedDate || new Date(0)) && isToday(day) && 'bg-primary text-primary-foreground'
              )}>
                {format(day, 'd')}
              </span>
              <div className="flex-1 mt-1 space-y-1 overflow-y-auto text-xs">
                  {dayEvents.slice(0, 4).map(event => {
                      const bgColor = event.venue?.color || 'hsl(var(--primary))';
                      return (
                          <div
                              key={event.uniqueOccurrenceId}
                              className="p-1 rounded-sm truncate"
                              style={{
                                  backgroundColor: bgColor,
                                  color: getContrastingTextColor(bgColor)
                              }}
                              title={event.title}
                          >
                              {toTitleCase(event.title)}
                          </div>
                      );
                  })}
                  {dayEvents.length > 4 && <div className="text-xs text-muted-foreground pt-1">... and {dayEvents.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );

  const MobileCalendar = () => {
    const CustomDayContent = (props: DayContentProps) => {
        const { date } = props;
        const dateKey = format(date, 'yyyy-MM-dd');
        const dayEvents = eventsByDate.get(dateKey) || [];
        const uniqueVenueColors = Array.from(
          new Set(dayEvents.map((e) => e.venue?.color).filter(Boolean) as string[])
        );
  
        return (
          <>
            {format(date, 'd')}
            {uniqueVenueColors.length > 0 && (
              <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center space-x-1">
                {uniqueVenueColors.slice(0, 3).map((color, index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}
          </>
        );
      }
    
    return (
      <div {...monthSwipeHandlers}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          month={currentMonth}
          onMonthChange={handleMonthChange}
          className="w-full rounded-md border"
          classNames={{
              cell: "h-9 w-full text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside: "day-outside text-muted-foreground opacity-50",
          }}
          components={{ DayContent: CustomDayContent }}
        />
      </div>
    );
  };

  const FilterPanel = () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold mb-2">Venues</h4>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {venues.map((v) => (
            <div key={v.id} className="flex items-center space-x-2">
              <Checkbox id={`venue-${v.id}`} checked={selectedVenues.includes(v.id)} onCheckedChange={() => handleVenueToggle(v.id)} />
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-border"
                aria-hidden="true"
                style={{ backgroundColor: v.color }}
                title={`${v.name} color`}
              />
              <Label htmlFor={`venue-${v.id}`} className="cursor-pointer">{v.name}</Label>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <h4 className="font-semibold mb-2">Event Types</h4>
        <div className="space-y-2">
          {eventTypes.map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox id={`type-${type}`} checked={selectedTypes.includes(type)} onCheckedChange={() => handleTypeToggle(type)} />
              <Label htmlFor={`type-${type}`} className="cursor-pointer capitalize">{toTitleCase(type.replace('-', ' '))}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-full lg:max-w-none">
      <div className="lg:col-span-2">
        {isMobile ? <MobileCalendar /> : <DesktopCalendar />}
      </div>
      <div className="lg:col-span-1">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl md:text-2xl font-headline">
            {selectedDate ? format(selectedDate, 'MMMM d') : 'Events'}
          </h2>
          <div className="flex items-center gap-2">
            {selectedEventId && (
              <Button variant="outline" size="sm" onClick={() => setSelectedEventId(null)}>
                <X className="mr-2 h-4 w-4" /> Clear
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90" data-tour="filter"><FilterIcon className="mr-2 h-4 w-4" /> Filter</Button>
              </PopoverTrigger>
              {isMobile ? (
                <PopoverContent align="center" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none w-auto">
                  <div className="fixed left-1/2 top-1/2 z-[60] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-md border bg-popover p-4 text-popover-foreground shadow-md max-h-[80vh] overflow-y-auto">
                    <FilterPanel />
                  </div>
                </PopoverContent>
              ) : (
                <PopoverContent align="end" sideOffset={8} collisionPadding={8} className="w-72 p-4 max-h-[80vh] overflow-y-auto">
                  <FilterPanel />
                </PopoverContent>
              )}
            </Popover>
          </div>
        </div>
        {isVenueRep && !venueRepOnboardingCompleted && (
          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Welcome! Let's get you started</CardTitle>
              <CardDescription>As a venue rep, you can add and update events for your assigned venues.</CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <Button size="sm" onClick={() => setCreateEventOpen(true)} data-tour="add-event">
                <Plus className="mr-2 h-4 w-4" /> Add your first event
              </Button>
              <Button variant="ghost" size="sm" className="ml-2" onClick={() => { setOnboardingStep(1); setOnboardingOpen(true); }}>
                Learn more
              </Button>
            </CardFooter>
          </Card>
        )}
        <div className="space-y-4">
          {selectedDayEvents.length > 0 ? (
            selectedDayEvents.map((event, idx) => {
              const isSelected = selectedEventId === event.id;
              return (
                <Card 
                  key={event.uniqueOccurrenceId}
                  className={cn(
                    "flex flex-col transition-shadow duration-300 ease-in-out",
                    isSelected ? "z-10 shadow-lg" : ""
                  )}
                  style={{ borderLeft: `4px solid ${event.venue?.color || 'hsl(var(--primary))'}` }}
                  data-tour={idx === 0 ? 'event-card' : undefined}
                >
                  <div onClick={() => handleCardClick(event.id)} className="cursor-pointer flex-grow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="font-headline text-lg">{toTitleCase(event.title)}</CardTitle>
                          <CardDescription className="pt-2 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 flex-shrink-0" /> <span>{event.venue?.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Ticket className="h-4 w-4 flex-shrink-0" /> 
                              <span className="capitalize">
                                {toTitleCase(event.type.replace('-', ' '))}
                                {event.time && ` at ${format(new Date(`1970-01-01T${event.time}`), 'h:mm a')}`}
                              </span>
                            </div>
                          </CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); handleEditClick(event); }}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit Event</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="relative pt-0 pb-4">
                      {event.tags && event.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {event.tags.map(tag => (
                                <Badge key={tag} variant="outline">{toTitleCase(tag)}</Badge>
                            ))}
                        </div>
                      )}
                      <p className={cn("text-sm text-muted-foreground", !isSelected && "line-clamp-3")}>
                        {event.description}
                      </p>
                      {!isSelected && event.description && (
                        <div className="absolute bottom-4 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                      )}
                       <div className={cn("w-full transition-all duration-300 ease-in-out overflow-hidden", isSelected ? "max-h-96 opacity-100 mt-4" : "max-h-0 opacity-0")}>
                          <Separator className="mb-3" />
                          <ReviewList reviews={event.reviews} />
                      </div>
                    </CardContent>
                  </div>
                  <CardFooter>
                    <div className="flex w-full flex-wrap items-center justify-start gap-x-4 gap-y-2">
                      {event.url && (
                        <Button variant="link" size="sm" asChild className="p-0 h-auto">
                          <a href={event.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            Visit Website
                            <ExternalLink className="h-4 w-4 ml-1" />
                          </a>
                        </Button>
                      )}
                       {event.reviews?.length > 0 && (
                        <Button variant="link" size="sm" asChild className="p-0 h-auto text-accent hover:text-accent/80">
                            <Link href="/reviews" onClick={(e) => e.stopPropagation()}>
                                View Reviews ({event.reviews.length})
                                <MessageSquareText className="h-4 w-4 ml-1" />
                            </Link>
                        </Button>
                      )}
                      {isReviewer && isOccurrenceInPast(event) && isReviewableEventType(event.type) && (
                        <Button variant="secondary" size="sm" className="h-auto py-1" onClick={(e) => { e.stopPropagation(); handleLeaveReviewClick(event); }}>
                          Leave a Review
                          <MessageSquareQuote className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              )
            })
          ) : (
            <div className="text-center pt-10 text-muted-foreground h-full flex flex-col items-center justify-center rounded-lg">
              <CalendarDays className="h-10 w-10 mb-3 text-muted-foreground/50" />
              <p className="font-semibold text-sm">{selectedEventId ? 'No performances on this day.' : 'No events scheduled.'}</p>
              <p className="text-xs">Select another day or change filters.</p>
            </div>
          )}
        </div>
      </div>
      <EventEditorModal
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          eventToEdit={editingEvent}
          venues={venues}
      />
      <ReviewSubmissionModal
        isOpen={isReviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        event={selectedEventForReview}
      />
      <Dialog open={isOnboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="w-[95vw] sm:w-auto sm:max-w-[640px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-headline">Welcome, Venue Representative</DialogTitle>
            <DialogDescription>
              A quick walkthrough to help you add events and understand approvals.
            </DialogDescription>
          </DialogHeader>
          {onboardingStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>You now have access to add events to the calendar.</strong></p>
                <p>When you submit an event, an admin will review and approve it before it appears publicly.</p>
                <p>Keeping theatre events up to date can be a collective community effort — your submissions help the whole scene.</p>
                {venueRepPolicyAccepted ? (
                  <div className="rounded-md border border-green-200 bg-green-50 text-foreground p-3">
                    You have already acknowledged the Venue Rep Policy. You can review it again any time, or continue the walkthrough.
                  </div>
                ) : (
                  <p>
                    <strong className="text-foreground">Policy required:</strong> You must review and accept the
                    <Link href={`/policies/venue-reps?returnTo=${encodeURIComponent(pathname + '?onboarding=venue-rep')}`} className="underline ml-1">Venue Rep Policy</Link>
                    before continuing the walkthrough.
                  </p>
                )}
              </div>
              <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <Link href={`/policies/venue-reps?returnTo=${encodeURIComponent(pathname + '?onboarding=venue-rep')}`}>{venueRepPolicyAccepted ? 'Review policy' : 'Review and accept policy'}</Link>
                    </Button>
                    <Button className="w-full sm:w-auto" onClick={() => setOnboardingStep(2)} disabled={!venueRepPolicyAccepted}>Next</Button>
                  </div>
                  <Button variant="link" className="text-muted-foreground px-0 h-auto" onClick={async () => { await setHasSeenVenueRepIntro?.(); setOnboardingOpen(false); }}>Skip walkthrough</Button>
                </div>
              </div>
            </div>
          )}
          {onboardingStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>How to add an event</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Click the “Add Event” button.</li>
                  <li>Choose the venue you represent.</li>
                  <li>Enter the title, description, and optional website URL.</li>
                  <li>Select the type and add tags if helpful.</li>
                  <li>Add one or more dates and times, then submit.</li>
                </ul>
                <p>After submission, you can edit details later; admins approve before publishing.</p>
              </div>
              <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOnboardingStep(1)}>Back</Button>
                  <div className="flex gap-2 flex-wrap">
                    <Button className="w-full sm:w-auto" onClick={() => setOnboardingStep(3)}>Try a demo</Button>
                  </div>
                  <Button variant="link" className="text-muted-foreground px-0 h-auto" onClick={async () => { await setHasSeenVenueRepIntro?.(); setOnboardingOpen(false); }}>Skip walkthrough</Button>
                </div>
              </div>
            </div>
          )}
          {onboardingStep === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">This is a demo form for practice only. Submitting will not save any data.</p>
              <EventEditorForm
                venues={venues}
                demoMode
                submitLabel="Submit Demo Event"
                initialData={{
                  title: 'Demo Event',
                  description: 'A quick practice event. This will not be saved.',
                  venue: '',
                  occurrences: [{ date: '', time: '' }],
                  tags: [],
                } as any}
                onSuccess={() => {
                  setOnboardingStep(4);
                }}
              />
              <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOnboardingStep(2)}>Back</Button>
                  <Button variant="link" className="text-muted-foreground px-0 h-auto" onClick={async () => { await setHasSeenVenueRepIntro?.(); setOnboardingOpen(false); }}>Skip walkthrough</Button>
                </div>
              </div>
            </div>
          )}
          {onboardingStep === 4 && (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p><strong>Nice! You're ready to add real events.</strong></p>
              <p>Your demo helped you learn the fields. Now create your first event for one of your venues.</p>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <Button variant="outline" className="w-full sm:w-auto" onClick={async () => { await setVenueRepOnboardingCompleted?.(); setOnboardingOpen(false); }}>Finish</Button>
                <Button className="w-full sm:w-auto" onClick={async () => { await setVenueRepOnboardingCompleted?.(); setOnboardingOpen(false); setCreateEventOpen(true); }}>Add a real event</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isCreateEventOpen} onOpenChange={setCreateEventOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Add Event</DialogTitle>
            <DialogDescription>Fill in the details below to create a new event.</DialogDescription>
          </DialogHeader>
          <EventEditorForm
            venues={venues}
            onSuccess={async () => {
              setCreateEventOpen(false);
              await setVenueRepOnboardingCompleted?.();
            }}
          />
        </DialogContent>
      </Dialog>
      {!isAdmin && isVenueRep && (
        <Button
          className="fixed bottom-20 right-6 z-50 h-14 w-14 rounded-full shadow-lg md:bottom-6 md:right-6"
          size="icon"
          onClick={() => setCreateEventOpen(true)}
          data-tour="add-event"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Add Event</span>
        </Button>
      )}
      {isAdmin && <AddEventButton venues={venues} />}
    </div>
  );
}

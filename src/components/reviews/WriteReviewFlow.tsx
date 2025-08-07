'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, PenTool, Search, AlertCircle, Mail } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, addDays, isPast } from 'date-fns';
import type { Event, EventOccurrence, ExpandedCalendarEvent } from '@/lib/types';
import { ReviewSubmissionModal } from '@/components/reviews/ReviewSubmissionModal';
import Link from 'next/link';

interface WriteReviewFlowProps {
  trigger: React.ReactNode;
}

export function WriteReviewFlow({ trigger }: WriteReviewFlowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'shows' | 'dates' | 'contact'>('shows');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedExpandedEvent, setSelectedExpandedEvent] = useState<ExpandedCalendarEvent | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch recent events when dialog opens
  useEffect(() => {
    if (isOpen && events.length === 0) {
      fetchRecentEvents();
    }
  }, [isOpen]);

  const fetchRecentEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/events');
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      
      const data = await response.json();
      
      // Filter for events that have had performances in the last 60 days or upcoming in next 30 days
      const now = new Date();
      const sixtyDaysAgo = addDays(now, -60);
      const thirtyDaysFromNow = addDays(now, 30);
      
      const reviewableEvents = data.events.filter((event: Event) => {
        if (event.status !== 'approved' || event.type?.toLowerCase() === 'audition') {
          return false;
        }
        
        if (!event.occurrences || event.occurrences.length === 0) {
          return false;
        }
        
        // Check if any occurrence is within our date range
        return event.occurrences.some(occurrence => {
          const occurrenceDate = parseISO(occurrence.date);
          return isAfter(occurrenceDate, sixtyDaysAgo) && isBefore(occurrenceDate, thirtyDaysFromNow);
        });
      });
      
      // Sort by most recent occurrence
      reviewableEvents.sort((a: Event, b: Event) => {
        const latestA = Math.max(...a.occurrences.map(o => parseISO(o.date).getTime()));
        const latestB = Math.max(...b.occurrences.map(o => parseISO(o.date).getTime()));
        return latestB - latestA;
      });
      
      setEvents(reviewableEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEventSelect = (event: Event) => {
    // Check if the event has any past occurrences
    const hasPastOccurrences = event.occurrences?.some(occurrence => 
      isPast(parseISO(occurrence.date))
    );
    
    if (!hasPastOccurrences) {
      // Don't allow selection of events with no past occurrences
      return;
    }
    
    setSelectedEvent(event);
    setStep('dates');
  };

  const handleDateSelect = (occurrence: EventOccurrence) => {
    if (!selectedEvent) return;
    
    // Only allow selection of past occurrences
    if (!isPast(parseISO(occurrence.date))) {
      return;
    }
    
    // Create an ExpandedCalendarEvent object for the ReviewSubmissionModal
    const expandedEvent: ExpandedCalendarEvent = {
      ...selectedEvent,
      uniqueOccurrenceId: `${selectedEvent.id}-${occurrence.date}-${occurrence.time || 'all-day'}`,
      date: occurrence.date,
      time: occurrence.time,
      venue: undefined, // We don't have venue data in this context
      reviews: [] // Empty reviews array
    };
    
    setSelectedExpandedEvent(expandedEvent);
    setIsOpen(false); // Close the selection dialog
    setIsReviewModalOpen(true); // Open the review modal
  };

  const resetFlow = () => {
    setStep('shows');
    setSelectedEvent(null);
    setSelectedExpandedEvent(null);
    setError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(resetFlow, 300); // Reset after dialog closes
  };
  
  const handleReviewModalClose = () => {
    setIsReviewModalOpen(false);
    setSelectedExpandedEvent(null);
    // Reset the entire flow after successful review submission
    setTimeout(resetFlow, 300);
  };

  const renderShowSelection = () => {
    // Separate events into reviewable (past) and upcoming
    const reviewableEvents = events.filter((event: Event) => 
      event.occurrences?.some((occurrence: EventOccurrence) => isPast(parseISO(occurrence.date)))
    );
    
    const upcomingEvents = events.filter((event: Event) => 
      !event.occurrences?.some((occurrence: EventOccurrence) => isPast(parseISO(occurrence.date)))
    );
    
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Select a Show</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose from shows you've attended. Upcoming shows are shown but cannot be reviewed yet.
          </p>
        </div>
        
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchRecentEvents} variant="outline">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {/* Reviewable Events */}
            {reviewableEvents.length > 0 && (
              <div className="space-y-3">
                {reviewableEvents.map((event: Event) => {
                  const firstOccurrence = event.occurrences?.[0];
                  
                  return (
                    <Card 
                      key={event.id} 
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handleEventSelect(event)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{event.title}</h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {firstOccurrence && (
                                <>
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {format(parseISO(firstOccurrence.date), 'MMM d, yyyy')}
                                    {firstOccurrence.time && (
                                      <span className="ml-1">
                                        at {format(parseISO(`2000-01-01T${firstOccurrence.time}`), 'h:mm a')}
                                      </span>
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            {event.tags && event.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {event.tags.slice(0, 3).map((tag: string) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            
            {/* Upcoming Events (Disabled) */}
            {upcomingEvents.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  Upcoming Shows (Cannot Review Yet)
                </div>
                {upcomingEvents.map((event: Event) => {
                  const firstOccurrence = event.occurrences?.[0];
                  
                  return (
                    <Card 
                      key={event.id} 
                      className="opacity-50 cursor-not-allowed"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-muted-foreground">{event.title}</h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {firstOccurrence && (
                                <>
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {format(parseISO(firstOccurrence.date), 'MMM d, yyyy')}
                                    {firstOccurrence.time && (
                                      <span className="ml-1">
                                        at {format(parseISO(`2000-01-01T${firstOccurrence.time}`), 'h:mm a')}
                                      </span>
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            {event.tags && event.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {event.tags.slice(0, 3).map((tag: string) => (
                                  <Badge key={tag} variant="outline" className="text-xs opacity-60">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="mt-2">
                              <Badge variant="secondary" className="text-xs">
                                Opens {format(parseISO(firstOccurrence?.date || ''), 'MMM d')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            
            {reviewableEvents.length === 0 && upcomingEvents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No shows found</p>
              </div>
            )}
          </div>
        )}
        
        <div className="pt-4 border-t">
          <Button 
            onClick={() => setStep('contact')} 
            variant="ghost" 
            className="w-full"
          >
            <Search className="mr-2 h-4 w-4" />
            Don't see your show?
          </Button>
        </div>
      </div>
    );
  };

  const renderDateSelection = () => {
    if (!selectedEvent) return null;
    
    const sortedOccurrences = selectedEvent.occurrences
      .map(o => ({ ...o, parsedDate: parseISO(o.date) }))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
    
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Which performance did you attend?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select the date you saw <strong>{selectedEvent.title}</strong>
          </p>
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedOccurrences.map((occurrence, index) => {
            const isPast = isBefore(occurrence.parsedDate, new Date());
            
            return (
              <Card 
                key={`${occurrence.date}-${index}`}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleDateSelect(occurrence)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {format(occurrence.parsedDate, 'EEEE, MMMM d, yyyy')}
                      </div>
                      {occurrence.time && (
                        <div className="text-sm text-muted-foreground">
                          {occurrence.time}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isPast && (
                        <Badge variant="outline" className="text-xs">
                          Past
                        </Badge>
                      )}
                      <PenTool className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        <div className="flex gap-2">
          <Button onClick={resetFlow} variant="outline" className="flex-1">
            Back to Shows
          </Button>
          <Button onClick={() => setStep('contact')} variant="ghost" className="flex-1">
            Wrong dates?
          </Button>
        </div>
      </div>
    );
  };

  const renderContactAdmin = () => (
    <div className="space-y-4 text-center">
      <div>
        <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Can't find your show?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This might happen if:
        </p>
        <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-1">
          <li>• The show was from more than 60 days ago</li>
          <li>• The show isn't listed in our calendar</li>
          <li>• You attended a show outside Eugene</li>
          <li>• The performance dates don't match what we have</li>
        </ul>
      </div>
      
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm mb-3">
          <strong>Need help?</strong> Contact our admin team and they'll help you get your review posted.
        </p>
        <Button asChild className="w-full">
          <Link href="mailto:admin@ourstage-eugene.com?subject=Review%20Help%20Needed">
            <Mail className="mr-2 h-4 w-4" />
            Contact Admin
          </Link>
        </Button>
      </div>
      
      <Button onClick={resetFlow} variant="outline" className="w-full">
        Back to Show Selection
      </Button>
    </div>
  );

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {trigger}
      </div>
      
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Write a Review
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto">
            {step === 'shows' && renderShowSelection()}
            {step === 'dates' && renderDateSelection()}
            {step === 'contact' && renderContactAdmin()}
          </div>
        </DialogContent>
      </Dialog>
      
      <ReviewSubmissionModal
        isOpen={isReviewModalOpen}
        onClose={handleReviewModalClose}
        event={selectedExpandedEvent}
      />
    </>
  );
}

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Ticket, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import type { Event, Venue, EventOccurrence } from '@/lib/types';
import Link from 'next/link';

type EventWithVenue = Event & { venue?: Venue };

interface ExpandableEventTileProps {
  event: EventWithVenue;
}

function formatOccurrence(occurrence: EventOccurrence) {
  try {
    // Manually parse date components to avoid timezone shift issues.
    const [year, month, day] = occurrence.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (occurrence.time) {
      const [hour, minute] = occurrence.time.split(':').map(Number);
      date.setHours(hour, minute);
      return format(date, "MMMM d, yyyy 'at' h:mm a");
    }
    return format(date, "MMMM d, yyyy");
  } catch (e) {
    return `${occurrence.date} at ${occurrence.time}`;
  }
}

export function ExpandableEventTile({ event }: ExpandableEventTileProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const primaryOccurrence = event.occurrences?.[0];
  const additionalOccurrences = event.occurrences?.slice(1) || [];
  const hasTags = event.tags && event.tags.length > 0;

  return (
    <Card 
      className={cn(
        "flex flex-col transition-all duration-500 ease-in-out shadow-lg hover:shadow-xl flex-shrink-0",
        "w-80", // Static width
        // Dynamic collapsed height based on content
        !isExpanded && (hasTags ? "h-[320px]" : "h-[280px]"),
        isExpanded && "w-96 min-h-[450px] h-auto" // Expanded: wider with min-height, grows to fit content
      )}
      style={{ borderLeft: `4px solid ${event.venue?.color || 'hsl(var(--primary))'}` }}
    >
      <div onClick={handleToggleExpand} className="cursor-pointer flex-grow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="font-headline font-bold text-primary text-lg leading-tight">
                {toTitleCase(event.title)}
              </CardTitle>
              <CardDescription className="pt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="font-medium">{event.venue?.name}</span>
                </div>
                {primaryOccurrence && (
                  <div className="flex items-center gap-2 text-sm">
                    <Ticket className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="capitalize">
                      {formatOccurrence(primaryOccurrence)}
                    </span>
                  </div>
                )}
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 flex-shrink-0 transition-transform duration-500 ease-in-out"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <ChevronDown className="h-4 w-4" />
              <span className="sr-only">{isExpanded ? 'Collapse' : 'Expand'} Event Details</span>
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="relative pt-0 pb-4">
          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {event.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {toTitleCase(tag)}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Description */}
          <p className={cn(
            "text-sm text-muted-foreground transition-all duration-500 ease-in-out",
            !isExpanded && "line-clamp-3"
          )}>
            {event.description}
          </p>
          
          {/* Gradient overlay for collapsed state */}
          {!isExpanded && event.description && (
            <div className="absolute bottom-4 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
          )}
          
          {/* Expanded content */}
          <div className={cn(
            "w-full transition-all duration-300 ease-in-out overflow-hidden",
            isExpanded ? "max-h-96 opacity-100 mt-4" : "max-h-0 opacity-0"
          )}>
            <Separator className="mb-4" />
            
            {/* Additional occurrences */}
            {additionalOccurrences.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-sm mb-2 text-foreground">Additional Performances:</h4>
                <div className="space-y-1">
                  {additionalOccurrences.map((occurrence, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Ticket className="h-3 w-3 flex-shrink-0" />
                      <span>{formatOccurrence(occurrence)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Event type */}
            {event.type && (
              <div className="mb-3">
                <span className="text-sm font-medium text-foreground">Type: </span>
                <span className="text-sm text-muted-foreground capitalize">
                  {toTitleCase(event.type.replace('-', ' '))}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </div>
      
      <CardFooter className="pt-0">
        <div className="flex w-full items-center justify-center gap-2">
          {event.url && (
            <Button variant="link" size="sm" asChild className="p-1 h-6 text-xs">
              <a 
                href={event.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1"
              >
                Visit Website
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild className="h-6 text-xs px-2">
            <Link href="/calendar" onClick={(e) => e.stopPropagation()}>
              View in Calendar
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Timeline, {
    TimelineHeaders,
    SidebarHeader,
    DateHeader,
    TimelineGroupBase,
    TimelineItemBase,
} from 'react-calendar-timeline';
import 'react-calendar-timeline/dist/style.css';
import moment from 'moment';
import { cn } from '@/lib/utils';
import { Event, Venue } from '@/lib/types';

// --- Types ---
interface TheatreTimelineProps {
    className?: string;
    events: Event[];
    venues: Venue[];
}

export function TheatreTimeline({ className, events, venues }: TheatreTimelineProps) {
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    // 1. Prepare Groups (Venues)
    const groups: TimelineGroupBase[] = useMemo(() => {
        return venues.map(v => ({
            id: v.id,
            title: v.name,
            bgColor: v.color, // Custom property we can use in rendering if needed
        }));
    }, [venues]);

    // 2. Prepare Items (Events)
    const items: TimelineItemBase<any>[] = useMemo(() => {
        return events
            .filter(e => e.occurrences && e.occurrences.length > 0) // Only show events with dates
            .filter(e => e.type.toLowerCase() !== 'audition') // Hide auditions
            .map(e => {
                // Sort occurrences to find start and end
                const sortedOccurrences = [...e.occurrences].sort((a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                );

                const startDate = moment(sortedOccurrences[0].date);
                const endDate = moment(sortedOccurrences[sortedOccurrences.length - 1].date).endOf('day');

                const venue = venues.find(v => v.id === e.venueId);

                return {
                    id: e.id,
                    group: e.venueId,
                    title: e.title,
                    start_time: startDate,
                    end_time: endDate,
                    itemProps: {
                        // Custom styles for the item container
                        style: {
                            background: venue?.color || '#888',
                            borderStyle: 'none',
                            borderWidth: 0,
                            borderRadius: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: '500',
                        },
                    },
                    // Store original event data for click handling
                    originalEvent: e,
                };
            });
    }, [events, venues]);

    // 3. Setup Time Range (Default view)
    const defaultTimeStart = moment().add(-1, 'month');
    const defaultTimeEnd = moment().add(3, 'months');

    const handleItemSelect = (itemId: number | string, e: any, time: number) => {
        const evt = events.find(ev => ev.id === itemId);
        if (evt) setSelectedEvent(evt);
    };

    // Calculate dynamic height: (rows * lineHeight) + header + footer + padding
    const ROW_HEIGHT = 60;
    const HEADER_HEIGHT = 110; // Approx
    const FOOTER_HEIGHT = 40;
    const totalHeight = (groups.length * ROW_HEIGHT) + HEADER_HEIGHT + FOOTER_HEIGHT;

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return <div
            className={cn("w-full bg-background border border-border rounded-xl", className)}
            style={{ height: `${totalHeight}px` }}
        />;
    }

    return (
        <div
            className={cn("w-full flex flex-col bg-background text-foreground border border-border rounded-xl overflow-hidden shadow-sm", className)}
            style={{ height: `${totalHeight}px` }}
        >
            <style jsx global>{`
        /* Override react-calendar-timeline styles for Light Mode (Default) */
        .react-calendar-timeline .rct-header-root {
          background: hsl(var(--secondary)) !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
        }
        .react-calendar-timeline .rct-dateHeader {
          background: hsl(var(--secondary)) !important;
          color: hsl(var(--muted-foreground)) !important;
          border-left: 1px solid hsl(var(--border)) !important;
        }
        .react-calendar-timeline .rct-dateHeader-primary {
          background: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
          font-weight: bold;
        }
        .react-calendar-timeline .rct-sidebar {
          background: hsl(var(--background)) !important;
          border-right: 1px solid hsl(var(--border)) !important;
        }
        .react-calendar-timeline .rct-sidebar-header {
          background: hsl(var(--secondary)) !important;
          color: hsl(var(--foreground)) !important;
          border-right: 1px solid hsl(var(--border)) !important;
        }
        .react-calendar-timeline .rct-sidebar-row {
          background: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
        }
        .react-calendar-timeline .rct-horizontal-lines .rct-hl-even,
        .react-calendar-timeline .rct-horizontal-lines .rct-hl-odd {
          background: hsl(var(--background)) !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
        }
        .react-calendar-timeline .rct-vertical-lines .rct-vl {
          border-left: 1px solid hsl(var(--border)) !important;
          background: transparent !important;
        }
        .react-calendar-timeline .rct-today {
          background: rgba(0, 0, 0, 0.05) !important;
        }
        .react-calendar-timeline .rct-item {
          overflow: hidden;
        }
      `}</style>

            <div className="flex-1 overflow-hidden">
                <Timeline
                    groups={groups}
                    items={items}
                    defaultTimeStart={defaultTimeStart}
                    defaultTimeEnd={defaultTimeEnd}
                    sidebarWidth={180}
                    lineHeight={60} // Taller rows
                    itemHeightRatio={0.7}
                    canMove={false}
                    canResize={false}
                    canChangeGroup={false}
                    onItemSelect={handleItemSelect}
                    stackItems
                >
                    <TimelineHeaders className="bg-secondary border-b border-border">
                        <SidebarHeader>
                            {({ getRootProps }) => {
                                return <div {...getRootProps()} className="p-4 font-bold text-foreground text-sm flex items-center">Venues</div>;
                            }}
                        </SidebarHeader>
                        <DateHeader unit="primaryHeader" />
                        <DateHeader
                            labelFormat={([startTime, endTime], unit, labelWidth) => {
                                if (labelWidth < 60) {
                                    return "";
                                }
                                return startTime.format("MMMM");
                            }}
                        />
                    </TimelineHeaders>
                </Timeline>
            </div>

            {/* Footer / Status */}
            <div className="h-10 border-t border-border bg-secondary/50 flex items-center px-4 text-xs text-muted-foreground">
                {selectedEvent ? (
                    <span>
                        Selected: <strong className="text-foreground">{selectedEvent.title}</strong> ({moment(selectedEvent.occurrences[0].date).format('MMM D, YYYY')} - {moment(selectedEvent.occurrences[selectedEvent.occurrences.length - 1].date).format('MMM D, YYYY')})
                    </span>
                ) : (
                    <span>Click an event to view details • Scroll to Zoom • Drag to Pan</span>
                )}
            </div>
        </div>
    );
}

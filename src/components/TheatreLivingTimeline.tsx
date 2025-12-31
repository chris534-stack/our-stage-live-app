'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import moment from 'moment';
import { cn, getVenueColor } from '@/lib/utils';
import { Event, Venue } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface TheatreLivingTimelineProps {
    className?: string;
    events: Event[];
    venues: Venue[];
}

export function TheatreLivingTimeline({ className, events, venues }: TheatreLivingTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
    const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
    const router = useRouter();

    // --- Configuration ---
    const ROW_HEIGHT = 80; // Reduced from 120 for more compact layout
    const EXPANDED_HEIGHT = 400; // Height when a venue is expanded
    const PADDING_X = 50;
    const START_DATE = moment().add(-3, 'years').toDate(); // Show 3 years history
    const END_DATE = moment().add(12, 'months').toDate(); // Show 1 year ahead

    // Calculate total height based on expansion state
    const totalHeight = useMemo(() => {
        if (expandedVenueId) {
            return EXPANDED_HEIGHT;
        }
        return venues.length * ROW_HEIGHT;
    }, [expandedVenueId, venues.length]);

    // --- Resize Observer ---
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: totalHeight,
                });
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [totalHeight]);

    // --- Scales ---
    const xScale = useMemo(() => {
        return d3.scaleTime()
            .domain([START_DATE, END_DATE])
            .range([PADDING_X, dimensions.width - PADDING_X]);
    }, [dimensions.width]);

    // --- Zoom Behavior ---
    useEffect(() => {
        if (!svgRef.current || dimensions.width === 0) return;

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 5]) // Zoom limits
            .translateExtent([[0, 0], [dimensions.width * 2, dimensions.height]]) // Pan limits
            .on('zoom', (event) => {
                setTransform(event.transform);
            });

        d3.select(svgRef.current).call(zoom);
    }, [dimensions.width, dimensions.height]);

    const rescaledXScale = transform.rescaleX(xScale);

    // Filter venues for display
    const displayVenues = useMemo(() => {
        if (expandedVenueId) {
            return venues.filter(v => v.id === expandedVenueId);
        }
        return venues;
    }, [venues, expandedVenueId]);

    const handleVenueClick = (venueId: string) => {
        if (expandedVenueId === venueId) {
            setExpandedVenueId(null); // Collapse if clicking same venue
        } else {
            setExpandedVenueId(venueId); // Expand clicked venue
        }
    };

    // --- Generate Paths ---
    // We'll create a "base" path for each venue that undulates
    // and "event" segments that sit on top of it.

    return (
        <div
            ref={containerRef}
            className={cn("w-full bg-white relative overflow-hidden rounded-xl border border-slate-200 shadow-sm", className)}
            style={{ height: totalHeight }}
        >
            {/* Background Effects - Subtle Light Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-white opacity-80" />

            {/* Collapse Button (when expanded) */}
            {expandedVenueId && (
                <button
                    onClick={() => setExpandedVenueId(null)}
                    className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-lg hover:bg-slate-800 transition-colors"
                >
                    Show All Venues
                </button>
            )}

            {/* SVG Container */}
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ overflow: 'visible' }}
            >
                <defs>
                    {/* Soft Shadow Filter for Light Mode */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feComposite in="coloredBlur" in2="SourceGraphic" operator="in" result="softGlow" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* Stronger Shadow for Events */}
                    <filter id="strong-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Time Axis Grid (Adaptive) */}
                {(() => {
                    const domain = rescaledXScale.domain();
                    const range = rescaledXScale.range();
                    const widthPixels = range[1] - range[0];
                    const months = moment(domain[1]).diff(moment(domain[0]), 'months');
                    const pixelsPerMonth = widthPixels / Math.max(months, 1);

                    let tickInterval = d3.timeMonth;
                    let tickFormat = (d: Date) => moment(d).format('MMM YYYY');
                    let showGrid = true;

                    if (pixelsPerMonth < 60) {
                        // Switch to Years
                        tickInterval = d3.timeYear;
                        tickFormat = (d: Date) => moment(d).format('YYYY');
                    }
                    if (pixelsPerMonth < 2) {
                        // Switch to Decades (every 10 years)
                        // d3 doesn't have timeDecade, so we filter years
                        tickInterval = d3.timeYear; // We'll filter manually below
                        tickFormat = (d: Date) => moment(d).format('YYYY');
                    }

                    let ticks = rescaledXScale.ticks(tickInterval);

                    // Filter for decades if needed
                    if (pixelsPerMonth < 2) {
                        ticks = ticks.filter(d => d.getFullYear() % 10 === 0);
                    }

                    return ticks.map((tick, i) => (
                        <g key={`tick-${i}`} transform={`translate(${rescaledXScale(tick)}, 0)`}>
                            <line y1={0} y2="100%" stroke="#000" strokeOpacity={0.05} strokeDasharray="4 4" />
                            <text y={20} fill="#64748b" fontSize={10} fontWeight="600" textAnchor="middle" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {tickFormat(tick)}
                            </text>
                        </g>
                    ));
                })()}

                {/* Venue Threads */}
                {dimensions.width > 0 && displayVenues.map((venue, index) => {
                    const yBase = expandedVenueId
                        ? EXPANDED_HEIGHT / 2
                        : (index * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                    const venueEvents = events.filter(e => e.venueId === venue.id && e.occurrences && e.occurrences.length > 0 && e.type.toLowerCase() !== 'audition');

                    return (
                        <VenueThread
                            key={venue.id}
                            venue={venue}
                            events={venueEvents}
                            yBase={yBase}
                            xScale={rescaledXScale}
                            width={dimensions.width}
                            transform={transform}
                            router={router}
                            isExpanded={expandedVenueId === venue.id}
                            onVenueClick={() => handleVenueClick(venue.id)}
                        />
                    );
                })}
            </svg>

            {/* Venue Labels (Dark Text) */}
            <div className="absolute left-4 top-0 bottom-0 flex flex-col pointer-events-none">
                {displayVenues.map((venue, index) => {
                    const height = expandedVenueId ? EXPANDED_HEIGHT : ROW_HEIGHT;
                    const isExpanded = expandedVenueId === venue.id;

                    return (
                        <div
                            key={`label-${venue.id}`}
                            className="flex items-center pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ height }}
                            onClick={() => handleVenueClick(venue.id)}
                        >
                            <span
                                className={cn(
                                    "font-bold tracking-wider uppercase transition-all",
                                    isExpanded ? "text-lg text-slate-900" : "text-sm text-slate-900"
                                )}
                                style={{
                                    textShadow: isExpanded ? `0 2px 8px ${getVenueColor(venue.color)}` : '0 1px 2px rgba(255,255,255,0.8)',
                                    color: isExpanded ? getVenueColor(venue.color) : undefined
                                }}
                            >
                                {venue.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- Subcomponent for Individual Venue Thread ---
function VenueThread({ venue, events, yBase, xScale, width, transform, router, isExpanded, onVenueClick }: {
    venue: Venue;
    events: Event[];
    yBase: number;
    xScale: d3.ScaleTime<number, number>;
    width: number;
    transform: d3.ZoomTransform;
    router: any;
    isExpanded?: boolean;
    onVenueClick: () => void;
}) {
    // Generate a random "noise" offset for the path to make it look organic
    const pathD = `M 0,${yBase} L ${width},${yBase}`;

    // --- Smart Decluttering Logic ---
    const visibleEvents = useMemo(() => {
        const bubbleRadius = 20; // 40px diameter / 2
        const padding = 5; // Extra space between bubbles
        const occupiedRanges: [number, number][] = [];

        // 1. Calculate X positions and Priority
        const eventData = events.map(event => {
            const sortedOccurrences = [...event.occurrences].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const startDate = new Date(sortedOccurrences[0].date);
            const endDate = new Date(sortedOccurrences[sortedOccurrences.length - 1].date);
            const duration = endDate.getTime() - startDate.getTime();
            const x = xScale(startDate);

            // Priority Score (Higher is better)
            let priority = 0;
            if (event.posterUrl) priority += 1000; // Posters are most important
            priority += duration / (1000 * 60 * 60 * 24); // Add days of duration
            // Tie-breaker: earlier events slightly higher priority to keep chronological order clean?
            // Actually, usually we want the "biggest" things to survive.

            return { event, x, priority };
        });

        // 2. Sort by Priority (Descending)
        eventData.sort((a, b) => b.priority - a.priority);

        // 3. Filter overlapping
        const visible: typeof eventData = [];

        for (const item of eventData) {
            // Skip if out of view
            if (item.x < -50 || item.x > width + 50) continue;

            const startX = item.x - bubbleRadius - padding;
            const endX = item.x + bubbleRadius + padding;

            let overlaps = false;
            for (const range of occupiedRanges) {
                if (startX < range[1] && endX > range[0]) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                visible.push(item);
                occupiedRanges.push([startX, endX]);
            }
        }

        return visible;
    }, [events, xScale, width]); // Re-run when zoom (xScale) changes

    // Reduce animation amplitude for compact layout
    const amplitude = isExpanded ? 20 : 10;

    return (
        <g onClick={onVenueClick} style={{ cursor: 'pointer' }}>
            {/* Base Thread - Undulating */}
            <motion.path
                d={pathD}
                stroke={getVenueColor(venue.color)}
                strokeWidth={isExpanded ? 3 : 2}
                strokeOpacity={isExpanded ? 0.5 : 0.3}
                fill="none"
                filter="url(#glow)"
                initial={{ d: `M 0,${yBase} Q ${width / 2},${yBase + 50} ${width},${yBase}` }}
                animate={{
                    d: [
                        `M 0,${yBase} Q ${width / 4},${yBase - amplitude} ${width / 2},${yBase} T ${width},${yBase}`,
                        `M 0,${yBase} Q ${width / 4},${yBase + amplitude} ${width / 2},${yBase} T ${width},${yBase}`,
                        `M 0,${yBase} Q ${width / 4},${yBase - amplitude} ${width / 2},${yBase} T ${width},${yBase}`
                    ]
                }}
                transition={{
                    duration: 10 + Math.random() * 5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />

            {/* Events - Bubbles */}
            {visibleEvents.map(({ event, x }) => (
                <EventBubble
                    key={event.id}
                    event={event}
                    venue={venue}
                    x={x}
                    y={yBase}
                    onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/archive/${event.id}`);
                    }}
                />
            ))}
        </g>
    );
}

function EventBubble({ event, venue, x, y, onClick }: { event: Event, venue: Venue, x: number, y: number, onClick: (e: React.MouseEvent) => void }) {
    const bubbleSize = 40;
    const radius = bubbleSize / 2;

    return (
        <g
            className="group cursor-pointer pointer-events-auto"
            onClick={onClick}
            transform={`translate(${x}, ${y})`}
        >
            <defs>
                <pattern id={`poster-${event.id}`} patternUnits="objectBoundingBox" width="1" height="1">
                    <image href={event.posterUrl} x="0" y="0" width={bubbleSize} height={bubbleSize} preserveAspectRatio="xMidYMid slice" />
                </pattern>
            </defs>

            <motion.circle
                r={radius}
                fill={event.posterUrl ? `url(#poster-${event.id})` : getVenueColor(venue.color)}
                stroke={getVenueColor(venue.color)}
                strokeWidth={2}
                filter="url(#strong-glow)"
                whileHover={{ scale: 1.2 }}
                animate={{
                    y: [-5, 5, -5]
                }}
                transition={{
                    y: {
                        duration: 4 + Math.random() * 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: Math.random() * 2
                    }
                }}
            />

            {/* Event Label (on hover) */}
            <foreignObject x={-100} y={-radius - 50} width={200} height={40} style={{ overflow: 'visible' }}>
                <div className="flex justify-center">
                    <div className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 p-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap w-fit">
                        {event.title}
                    </div>
                </div>
            </foreignObject>
        </g>
    );
}

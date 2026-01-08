'use client';

import type { Review } from '@/lib/types';
import { ReviewPreviewCard } from './ReviewPreviewCard';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { TrendingUp, Theater, Sparkles, MessageSquare } from 'lucide-react';

interface ShowMosaicSectionProps {
    showId: string;
    showTitle: string;
    posterUrl?: string;
    venueColor?: string;
    venueName?: string;
    reviews: Review[];
}

/**
 * ShowMosaicSection: Renders a "section" for one show on the reviews page.
 * - If posterUrl exists, displays a hero banner with the image.
 * - If posterUrl is missing, displays an enhanced gradient hero with theatre icon.
 * - Shows trending badges based on review count and recent activity.
 * - Below the hero, reviews are displayed in a masonry grid layout.
 */
export function ShowMosaicSection({
    showId,
    showTitle,
    posterUrl,
    venueColor = '#6366f1', // fallback indigo
    venueName,
    reviews,
}: ShowMosaicSectionProps) {

    // Determine if this show is "trending" (3+ reviews or high engagement)
    const totalLikes = reviews.reduce((sum, r) => sum + (r.likes || 0), 0);
    const isTrending = reviews.length >= 3 || totalLikes >= 10;
    const isHot = reviews.length >= 5 || totalLikes >= 20;

    // Check for recent reviews (within last 7 days)
    const hasRecentReviews = reviews.some(r => {
        const reviewDate = new Date(r.createdAt);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return reviewDate > weekAgo;
    });

    // Generate a gradient from the venue color for the fallback hero
    const fallbackGradient = `linear-gradient(135deg, ${venueColor} 0%, ${adjustColorBrightness(venueColor, -40)} 100%)`;

    return (
        <section className="mb-8">
            {/* Hero Banner */}
            {posterUrl ? (
                <div className="relative w-full h-32 sm:h-40 md:h-56 rounded-2xl overflow-hidden mb-5 shadow-lg group">
                    <Image
                        src={posterUrl}
                        alt={`Poster for ${showTitle}`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 80vw"
                    />
                    {/* Overlay with title and badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4 md:p-6">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            {isHot && (
                                <Badge className="bg-orange-500 text-white border-0 text-xs animate-pulse">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Hot
                                </Badge>
                            )}
                            {!isHot && isTrending && (
                                <Badge className="bg-accent text-accent-foreground border-0 text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Trending
                                </Badge>
                            )}
                            {hasRecentReviews && !isHot && (
                                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs backdrop-blur-sm">
                                    New Reviews
                                </Badge>
                            )}
                        </div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-headline text-white drop-shadow-lg">
                            {showTitle}
                        </h2>
                        <p className="text-white/70 text-sm mt-1">
                            <MessageSquare className="h-3 w-3 inline mr-1" />
                            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                        </p>
                    </div>
                </div>
            ) : (
                <div
                    className="relative w-full h-28 sm:h-32 md:h-40 rounded-2xl overflow-hidden mb-5 shadow-lg flex flex-col justify-end p-4 md:p-6"
                    style={{ background: fallbackGradient }}
                >
                    {/* Decorative theatre icon */}
                    <div className="absolute top-4 right-4 opacity-20">
                        <Theater className="h-16 w-16 md:h-24 md:w-24 text-white" />
                    </div>
                    {/* Abstract pattern overlay */}
                    <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%), 
                                          radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)`
                    }} />

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            {isHot && (
                                <Badge className="bg-orange-500 text-white border-0 text-xs animate-pulse">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Hot
                                </Badge>
                            )}
                            {!isHot && isTrending && (
                                <Badge className="bg-white/30 text-white border-0 text-xs backdrop-blur-sm">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Trending
                                </Badge>
                            )}
                        </div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-headline text-white drop-shadow-lg">
                            {showTitle}
                        </h2>
                        <div className="flex items-center gap-2 mt-1.5">
                            {venueName && (
                                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs">
                                    {venueName}
                                </Badge>
                            )}
                            <span className="text-white/70 text-sm">
                                <MessageSquare className="h-3 w-3 inline mr-1" />
                                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Masonry Grid of Reviews */}
            <div
                className={cn(
                    'columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 sm:gap-4 lg:gap-6',
                    '[&>div]:break-inside-avoid [&>div]:mb-3 sm:mb-4 lg:mb-6'
                )}
            >
                {reviews.map((review) => (
                    <div
                        key={review.id}
                        className={cn(
                            reviews.length === 1 ? '[column-span:all]' : ''
                        )}
                    >
                        <ReviewPreviewCard review={review} titleMode="reviewer" />
                    </div>
                ))}
            </div>
        </section>
    );
}

/**
 * Helper to adjust color brightness for gradient effect.
 * @param hex - Hex color string (e.g., "#ff5500")
 * @param amount - Brightness adjustment (-100 to 100)
 */
function adjustColorBrightness(hex: string, amount: number): string {
    // Handle shorthand hex
    let color = hex.replace('#', '');
    if (color.length === 3) {
        color = color.split('').map(c => c + c).join('');
    }

    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}


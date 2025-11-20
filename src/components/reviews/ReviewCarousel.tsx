'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Review } from '@/lib/types';
import { ReviewPreviewCard } from './ReviewPreviewCard';
import { cn } from '@/lib/utils';

interface ReviewCarouselProps {
  reviews: Review[];
}

export function ReviewCarousel({ reviews }: ReviewCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  // Gap between tiles (px). Keep in sync with tailwind gap-6 (~24px)
  const GAP_PX = 24;

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const scrollToPosition = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const currentScroll = container.scrollLeft;
    // Use visible width to advance roughly one card at a time on mobile (w-full),
    // and close to one tile on desktop (fixed 380px width).
    const visibleWidth = container.clientWidth;
    const scrollAmount = direction === 'left'
      ? -(visibleWidth - GAP_PX)
      : (visibleWidth - GAP_PX);

    container.scrollTo({
      left: currentScroll + scrollAmount,
      behavior: 'smooth'
    });
  };

  const handleWheel = (e: WheelEvent) => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    // Check if we can scroll horizontally
    const canScrollHorizontally = scrollWidth > clientWidth;
    
    if (canScrollHorizontally) {
      // Prevent vertical page scrolling when interacting with horizontal carousel
      e.preventDefault();
      e.stopPropagation();
      
      // Convert vertical scroll to horizontal scroll
      const scrollAmount = e.deltaY || e.deltaX;
      container.scrollLeft += scrollAmount;
    }
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleMediaChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktopLayout(event.matches);
    };

    // Set initial state
    handleMediaChange(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (isDesktopLayout) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => updateScrollButtons();
    container.addEventListener('scroll', handleScroll);
    container.addEventListener('wheel', handleWheel, { passive: false });
    updateScrollButtons();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [reviews, isDesktopLayout]);

  // Single item: still constrain to fixed card width and keep mobile gutter
  const singleItemLayout = (
    <div
      className={cn(
        'flex gap-6 px-3 sm:px-0',
        isDesktopLayout && 'grid grid-cols-2 xl:grid-cols-3 gap-6 px-0'
      )}
    >
      {reviews.map(review => (
        <div
          key={review.id}
          className={cn(
            'flex-shrink-0 w-full sm:w-[380px]',
            isDesktopLayout && 'w-full flex-shrink'
          )}
        >
          <ReviewPreviewCard review={review} />
        </div>
      ))}
    </div>
  );

  if (reviews.length <= 1 || isDesktopLayout) {
    return (
      <div
        className={cn(
          'w-full',
          isDesktopLayout && 'grid gap-6 lg:grid-cols-2 xl:grid-cols-3'
        )}
      >
        {isDesktopLayout
          ? reviews.map(review => (
              <div key={review.id} className="h-full">
                <ReviewPreviewCard review={review} />
              </div>
            ))
          : singleItemLayout}
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Left Arrow */}
      {!isDesktopLayout && (
        <Button
          variant="outline"
          size="icon"
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white transition-all duration-200 ${
            !canScrollLeft ? 'opacity-50 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={() => scrollToPosition('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Carousel Container */}
      <div
        ref={scrollContainerRef}
        className={cn(
          'flex gap-6 overflow-x-auto overflow-y-hidden scroll-smooth px-3 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
          isDesktopLayout && 'grid gap-6 px-0 overflow-visible lg:grid-cols-2 xl:grid-cols-3'
        )}
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {reviews.map(review => (
          <div
            key={review.id}
            className={cn(
              'flex-shrink-0 w-full sm:w-[380px]',
              isDesktopLayout && 'w-full flex-shrink'
            )}
          >
            {/* Ensure consistent height via card's min-h; wrapper width is fixed */}
            <ReviewPreviewCard review={review} />
          </div>
        ))}
      </div>

      {/* Right Arrow */}
      {!isDesktopLayout && (
        <Button
          variant="outline"
          size="icon"
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white transition-all duration-200 ${
            !canScrollRight ? 'opacity-50 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={() => scrollToPosition('right')}
          disabled={!canScrollRight}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}


    </div>
  );
}

'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Review } from '@/lib/types';
import { ReviewPreviewCard } from './ReviewPreviewCard';

interface ReviewCarouselProps {
  reviews: Review[];
}

export function ReviewCarousel({ reviews }: ReviewCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Tile width + gap = 380px + 24px = 404px per tile
  const TILE_WIDTH_WITH_GAP = 404;

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const scrollToPosition = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const currentScroll = scrollContainerRef.current.scrollLeft;
    const scrollAmount = direction === 'left' ? -TILE_WIDTH_WITH_GAP : TILE_WIDTH_WITH_GAP;
    
    scrollContainerRef.current.scrollTo({
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
    const container = scrollContainerRef.current;
    if (!container) return;

    // Update button states on scroll
    const handleScroll = () => updateScrollButtons();
    container.addEventListener('scroll', handleScroll);
    
    // Add native wheel event listener with passive: false to ensure preventDefault works
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    // Initial button state
    updateScrollButtons();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [reviews]);

  // Don't render carousel if only one or no reviews
  if (reviews.length <= 1) {
    return (
      <div className="flex justify-start">
        {reviews.map(review => (
          <ReviewPreviewCard key={review.id} review={review} />
        ))}
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Left Arrow */}
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

      {/* Carousel Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto overflow-y-hidden scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {reviews.map(review => (
          <div key={review.id} className="flex-shrink-0">
            <ReviewPreviewCard review={review} />
          </div>
        ))}
      </div>

      {/* Right Arrow */}
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


    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OptimizedGalleryProps {
  images: string[];
  onImageClick: (index: number) => void;
  isReordering?: boolean;
  isDeleting?: boolean;
  selectedPhotoToMove?: string | null;
  onReorderClick?: (url: string, index: number) => void;
  onDeleteClick?: (url: string) => void;
  isOwner?: boolean;
}

interface ImageLoadState {
  [key: string]: 'loading' | 'loaded' | 'error';
}

export function OptimizedGallery({
  images,
  onImageClick,
  isReordering = false,
  isDeleting = false,
  selectedPhotoToMove = null,
  onReorderClick,
  onDeleteClick,
  isOwner = false
}: OptimizedGalleryProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [imageLoadStates, setImageLoadStates] = useState<ImageLoadState>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  
  // Consistent 2x2 grid configuration for intentional curation
  const ITEMS_PER_PAGE = 4; // 2x2 grid on all devices for consistent page design
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);

  // Keep consistent 2x2 grid on all screen sizes
  useEffect(() => {
    setItemsPerPage(ITEMS_PER_PAGE);
  }, []);

  // Calculate pages with memoization
  const pages = useMemo(() => {
    if (!images.length) return [];
    const pageArray = [];
    for (let i = 0; i < images.length; i += itemsPerPage) {
      pageArray.push(images.slice(i, i + itemsPerPage));
    }
    return pageArray;
  }, [images, itemsPerPage]);

  const totalPages = pages.length;

  // Aggressive preloading strategy - preload ALL images for instant rendering
  const preloadAllImages = useCallback(() => {
    // Preload first 3 pages immediately for instant access
    const priorityPages = Math.min(3, totalPages);
    
    // Load priority pages first (current + next 2)
    for (let pageIndex = 0; pageIndex < priorityPages; pageIndex++) {
      pages[pageIndex]?.forEach((imageUrl, imgIndex) => {
        if (!imageLoadStates[imageUrl]) {
          setImageLoadStates(prev => ({ ...prev, [imageUrl]: 'loading' }));
          
          const img = new window.Image();
          img.onload = () => {
            setImageLoadStates(prev => ({ ...prev, [imageUrl]: 'loaded' }));
          };
          img.onerror = () => {
            setImageLoadStates(prev => ({ ...prev, [imageUrl]: 'error' }));
          };
          
          // High priority for first page, normal for others
          if (pageIndex === 0) {
            img.loading = 'eager';
          }
          img.src = imageUrl;
        }
      });
    }
    
    // Then preload remaining pages with slight delay to not block priority loading
    if (totalPages > 3) {
      setTimeout(() => {
        for (let pageIndex = 3; pageIndex < totalPages; pageIndex++) {
          pages[pageIndex]?.forEach(imageUrl => {
            if (!imageLoadStates[imageUrl]) {
              setImageLoadStates(prev => ({ ...prev, [imageUrl]: 'loading' }));
              
              const img = new window.Image();
              img.onload = () => {
                setImageLoadStates(prev => ({ ...prev, [imageUrl]: 'loaded' }));
              };
              img.onerror = () => {
                setImageLoadStates(prev => ({ ...prev, [imageUrl]: 'error' }));
              };
              img.src = imageUrl;
            }
          });
        }
      }, 100); // Small delay to prioritize first 3 pages
    }
  }, [pages, totalPages, imageLoadStates]);

  // Preload all images on component mount for instant rendering
  useEffect(() => {
    if (images.length > 0) {
      preloadAllImages();
    }
  }, [images.length, preloadAllImages]);

  // Navigation functions with smooth transitions
  const goToPage = useCallback((pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= totalPages || isTransitioning) return;
    
    setIsTransitioning(true);
    setCurrentPage(pageIndex);
    
    // Reset transition state after animation
    setTimeout(() => setIsTransitioning(false), 300);
  }, [totalPages, isTransitioning]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  // Touch/swipe handling for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartX.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;

    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        nextPage(); // Swipe left = next page
      } else {
        prevPage(); // Swipe right = previous page
      }
    }

    touchStartX.current = 0;
    touchStartY.current = 0;
  }, [nextPage, prevPage]);

  // Handle image click
  const handleImageClick = useCallback((imageUrl: string, index: number) => {
    const globalIndex = currentPage * itemsPerPage + index;
    
    if (isReordering && onReorderClick) {
      onReorderClick(imageUrl, globalIndex);
    } else if (!isDeleting && !isReordering) {
      onImageClick(globalIndex);
    }
  }, [currentPage, itemsPerPage, isReordering, isDeleting, onReorderClick, onImageClick]);

  // Render empty state
  if (!images.length) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg min-h-[300px]">
        <Camera className="h-12 w-12 mb-4" />
        <p className="font-medium text-lg">No Photos Yet</p>
        <p className="text-sm">This user hasn't added any photos to their gallery.</p>
      </div>
    );
  }

  const currentPageImages = pages[currentPage] || [];

  return (
    <div className="relative w-full">
      {/* Main Gallery Container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Gallery Grid */}
        <div 
          className={cn(
            "grid grid-cols-2 gap-1 sm:gap-2 transition-all duration-300 ease-out",
            isTransitioning && "opacity-90"
          )}
          style={{
            minHeight: '300px' // Consistent height for 2x2 grid
          }}
        >
          {currentPageImages.map((imageUrl, index) => {
            const globalIndex = currentPage * itemsPerPage + index;
            const isSelectedForMove = selectedPhotoToMove === imageUrl;
            const loadState = imageLoadStates[imageUrl] || 'loading';
            
            return (
              <div
                key={`${imageUrl}-${globalIndex}`}
                onClick={() => handleImageClick(imageUrl, index)}
                className={cn(
                  "aspect-square relative rounded-md sm:rounded-lg overflow-hidden group transition-all duration-200 bg-muted cursor-pointer",
                  isReordering && isSelectedForMove && "ring-2 sm:ring-4 ring-offset-1 sm:ring-offset-2 ring-primary z-10 scale-105 shadow-lg",
                  isReordering && selectedPhotoToMove && !isSelectedForMove && "opacity-60 hover:opacity-100 hover:scale-105",
                  !isReordering && !isDeleting && "hover:scale-105 hover:shadow-lg"
                )}
              >
                {/* Loading State */}
                {loadState === 'loading' && (
                  <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                
                {/* Error State */}
                {loadState === 'error' && (
                  <div className="absolute inset-0 bg-muted flex items-center justify-center">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Image */}
                <Image
                  src={imageUrl}
                  alt={`Gallery image ${globalIndex + 1}`}
                  fill
                  className={cn(
                    "object-cover transition-all duration-200",
                    loadState === 'loaded' ? "opacity-100" : "opacity-0",
                    !isReordering && !isDeleting && "group-hover:scale-110"
                  )}
                  sizes="(max-width: 640px) 50vw, 33vw"
                  priority={currentPage <= 1 && index < 4} // Prioritize first two pages (2x2 grid)
                  quality={85}
                />
                
                {/* Hover Overlay */}
                {!isDeleting && !isReordering && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                )}
                
                {/* Delete Button */}
                {isDeleting && isOwner && onDeleteClick && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0 opacity-100 hover:scale-110 transition-all duration-200 shadow-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(imageUrl);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                
                {/* Delete Mode Overlay */}
                {isDeleting && (
                  <div className="absolute inset-0 bg-red-500/10 group-hover:bg-red-500/20 transition-colors duration-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Controls - Hidden on Mobile, Visible on Desktop */}
      {totalPages > 1 && (
        <>
          {/* Previous Button - Hidden on mobile (sm and below) */}
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg transition-all duration-200",
              "hidden md:flex", // Hide on mobile and tablet, show only on desktop
              currentPage === 0 ? "opacity-50 cursor-not-allowed" : "hover:scale-110 hover:bg-background"
            )}
            onClick={prevPage}
            disabled={currentPage === 0 || isTransitioning}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {/* Next Button - Hidden on mobile (sm and below) */}
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg transition-all duration-200",
              "hidden md:flex", // Hide on mobile and tablet, show only on desktop
              currentPage === totalPages - 1 ? "opacity-50 cursor-not-allowed" : "hover:scale-110 hover:bg-background"
            )}
            onClick={nextPage}
            disabled={currentPage === totalPages - 1 || isTransitioning}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Page Indicators */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToPage(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                index === currentPage 
                  ? "bg-primary scale-125" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              disabled={isTransitioning}
            />
          ))}
        </div>
      )}
    </div>
  );
}

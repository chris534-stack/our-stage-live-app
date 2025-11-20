'use client';

import { CommunitySpotlightCard } from './CommunitySpotlight';
import { useEffect, useState } from 'react';
import type { CommunitySpotlight } from '@/lib/types';

type Props = {
  // full: original centered section with container
  // sidebar: compact version for right column on large screens
  variant?: 'full' | 'sidebar';
  className?: string;
};

export function CommunitySpotlightSection({ variant = 'full', className }: Props) {
  const [activeSpotlight, setActiveSpotlight] = useState<CommunitySpotlight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSpotlight() {
      try {
        const response = await fetch('/api/spotlight');
        if (response.ok) {
          const data = await response.json();
          setActiveSpotlight(data.spotlight);
        } else {
          console.error('Failed to fetch spotlight:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching active spotlight:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSpotlight();
  }, []);

  // Don't render anything if loading or no active spotlight
  if (loading || !activeSpotlight) {
    return null;
  }

  if (variant === 'sidebar') {
    return (
      <aside className={`w-full ${className ?? ''}`}>
        <div className="lg:sticky lg:top-24">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold font-headline text-primary">
              Community Spotlight
            </h2>
          </div>
          <CommunitySpotlightCard spotlight={activeSpotlight} />
        </div>
      </aside>
    );
  }

  return (
    <section className="py-8 md:py-12 bg-muted/30">
      <div className="container mx-auto px-0 sm:px-2">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold font-headline text-primary mb-2">
            Community Spotlight
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Celebrating the amazing people who make theatre possible in Eugene
          </p>
        </div>
        
        <div className="flex justify-center">
          <CommunitySpotlightCard spotlight={activeSpotlight} />
        </div>
      </div>
    </section>
  );
}

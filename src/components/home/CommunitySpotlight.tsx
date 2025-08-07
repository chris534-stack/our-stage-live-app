'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, ExternalLink } from 'lucide-react';
import type { CommunitySpotlight } from '@/lib/types';

interface CommunitySpotlightProps {
  spotlight: CommunitySpotlight;
}

export function CommunitySpotlightCard({ spotlight }: CommunitySpotlightProps) {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Community Spotlight: ${spotlight.name}`,
          text: `Check out this amazing community member spotlight featuring ${spotlight.name}!`,
          url: window.location.href,
        });
      } catch (error) {
        // Fall back to copying to clipboard
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    const text = `Community Spotlight: ${spotlight.name}\n\n${spotlight.story}\n\nSee more at ${window.location.href}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-to-br from-background to-muted/30 border-2 border-primary/10 shadow-lg">
      <CardContent className="p-6 md:p-8">
        {/* Header with photo and basic info */}
        <div className="flex flex-col items-center text-center mb-6">
          {/* Profile Photo */}
          <div className="relative mb-4">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-primary/20 shadow-lg">
              <img
                src={spotlight.photoUrl}
                alt={spotlight.name}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Decorative ring */}
            <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-pulse"></div>
          </div>

          {/* Name */}
          <h3 className="text-2xl md:text-3xl font-bold font-headline text-primary mb-2">
            {spotlight.name}
          </h3>

          {/* Tags/Roles */}
          {spotlight.tags && spotlight.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {spotlight.tags.map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Story */}
        <div className="mb-6">
          <div className="prose prose-sm md:prose-base max-w-none text-center">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {spotlight.story}
            </p>
          </div>
        </div>

        {/* Links and Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* External Links */}
          {spotlight.links?.website && (
            <Button 
              variant="outline" 
              size="sm" 
              asChild
              className="gap-2"
            >
              <a href={spotlight.links.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Website
              </a>
            </Button>
          )}
          
          {spotlight.links?.social && (
            <Button 
              variant="outline" 
              size="sm" 
              asChild
              className="gap-2"
            >
              <a href={spotlight.links.social} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Social
              </a>
            </Button>
          )}

          {/* Share Button */}
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleShare}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>

        {/* Attribution */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Spotlighted by Our Stage, Eugene • {new Date(spotlight.createdAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

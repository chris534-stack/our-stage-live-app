'use client';

import { HeroMembersButton } from '@/components/home/HeroMembersButton';
import { Calendar, Star, Sparkles, Theater } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * HomeHero: A modern, visually engaging hero section for the home page.
 * Features a gradient background, floating icons, and prominent CTA buttons.
 */
export function HomeHero() {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/95 via-primary to-primary/85 p-8 md:p-12 text-primary-foreground">
            {/* Decorative floating elements */}
            <div className="absolute top-4 right-8 opacity-20 animate-subtle-breathe">
                <Theater className="h-16 w-16 md:h-24 md:w-24" />
            </div>
            {/* Moved from bottom-left to top-left to avoid text overlap */}
            <div className="absolute top-8 left-8 opacity-15 animate-subtle-breathe delay-500">
                <Sparkles className="h-12 w-12 md:h-16 md:w-16" />
            </div>
            <div className="absolute top-1/2 right-1/4 opacity-10 animate-subtle-breathe delay-700">
                <Star className="h-8 w-8 md:h-12 md:w-12" />
            </div>

            {/* Blurred accent orbs */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent/25 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-accent/20 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-3xl" />

            {/* Content */}
            <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
                {/* Glassmorphic pill */}
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                    <Sparkles className="h-4 w-4" />
                    <span>Eugene's Theatre Community Hub</span>
                </div>

                {/* Main heading */}
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-6xl font-bold font-headline leading-tight">
                        Our Stage,
                        <span className="block text-accent">Eugene</span>
                    </h1>
                    <div className="h-1.5 bg-accent/80 w-24 mx-auto rounded-full" />
                </div>

                {/* Subheading */}
                <p className="text-primary-foreground/85 text-lg md:text-xl max-w-2xl mx-auto">
                    Your one-stop resource for performances, auditions, workshops, and community connections in Eugene, Oregon.
                </p>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
                    <HeroMembersButton />
                    <Link href="/calendar">
                        <Button
                            size="lg"
                            variant="outline"
                            className="bg-primary/20 hover:bg-white hover:text-primary border-white/40 text-white backdrop-blur-sm transition-all duration-300 px-6"
                        >
                            <Calendar className="mr-2 h-5 w-5" />
                            View Calendar
                        </Button>
                    </Link>
                </div>

                {/* Helper text */}
                <p className="text-xs text-primary-foreground/60">
                    Discover shows, connect with artists, and support local theatre.
                </p>
            </div>
        </div>
    );
}

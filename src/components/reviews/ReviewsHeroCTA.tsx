'use client';

import { WriteReviewFlow } from '@/components/reviews/WriteReviewFlow';
import { Button } from '@/components/ui/button';
import { PenTool, MessageSquarePlus, Sparkles } from 'lucide-react';

/**
 * ReviewsHeroCTA: A modern, visually engaging call-to-action for the reviews page.
 * Features a gradient background, floating icons, and prominent CTA button.
 */
export function ReviewsHeroCTA() {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-8 md:p-12 text-primary-foreground">
            {/* Decorative floating elements */}
            <div className="absolute top-4 right-8 opacity-20 animate-subtle-breathe">
                <MessageSquarePlus className="h-16 w-16 md:h-24 md:w-24" />
            </div>
            {/* Moved from bottom-left to top-left */}
            <div className="absolute top-8 left-8 opacity-15 animate-subtle-breathe delay-500">
                <Sparkles className="h-12 w-12 md:h-16 md:w-16" />
            </div>
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-accent/15 rounded-full blur-3xl" />

            {/* Content */}
            <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                    <Sparkles className="h-4 w-4" />
                    <span>Join the conversation</span>
                </div>

                <h2 className="text-3xl md:text-4xl font-bold font-headline leading-tight">
                    Your voice matters.
                    <span className="block text-accent">Share your experience.</span>
                </h2>

                <p className="text-primary-foreground/80 text-lg max-w-lg mx-auto">
                    Help fellow theatre lovers discover great shows. Write a review and become part of Eugene's theatre community.
                </p>

                <WriteReviewFlow
                    trigger={
                        <Button
                            size="lg"
                            variant="secondary"
                            className="bg-white text-primary hover:bg-white/90 shadow-lg hover:shadow-xl transition-all duration-300 text-base px-8"
                        >
                            <PenTool className="mr-2 h-5 w-5" />
                            Write a Review
                        </Button>
                    }
                />

                <p className="text-xs text-primary-foreground/60">
                    Already seen a show? It only takes a few minutes.
                </p>
            </div>
        </div>
    );
}


'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReviewerRequestForm } from '@/components/reviews/ReviewerRequestForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { PenTool } from 'lucide-react';
import Link from 'next/link';

export function BecomeReviewerCTA() {
    const { isReviewer } = useAuth();

    if (isReviewer) {
        // Show encouragement to write reviews for existing reviewers
        return (
            <Card className="bg-secondary/50 border-accent/20 shadow-lg">
                <div className="grid md:grid-cols-2 items-center">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline text-accent">Share Your Theatre Insights</CardTitle>
                        <CardDescription className="text-muted-foreground mt-4 space-y-3">
                            <p>
                                As a community reviewer, your voice matters! Help fellow theatre-goers discover amazing shows and support local artists.
                            </p>
                            <p>
                                Have you attended a recent performance? Share your thoughts and contribute to our vibrant theatre community.
                            </p>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 md:pt-0 flex items-center justify-center">
                        <Button asChild size="lg" className="w-full max-w-xs">
                            <Link href="/calendar">
                                <PenTool className="mr-2 h-4 w-4" />
                                Write a Review
                            </Link>
                        </Button>
                    </CardContent>
                </div>
            </Card>
        );
    }

    // Show original content for non-reviewers
    return (
        <Card className="bg-secondary/50 border-accent/20 shadow-lg">
            <div className="grid md:grid-cols-2 items-center">
                 <CardHeader>
                    <CardTitle className="text-2xl font-headline text-accent">Become a Community Reviewer</CardTitle>
                    <CardDescription className="text-muted-foreground mt-4 space-y-3">
                        <p>
                        Love theatre? Have a thoughtful perspective? Represent the voice of our community and help enrich the Eugene theatre scene.
                        </p>
                        <p>
                        Your insights support local artists and help others discover great shows.
                        </p>
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 md:pt-0 flex items-center justify-center">
                    <ReviewerRequestForm />
                </CardContent>
            </div>
        </Card>
    );
}

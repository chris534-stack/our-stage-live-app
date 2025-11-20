
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WriteReviewFlow } from '@/components/reviews/WriteReviewFlow';
import { PenTool } from 'lucide-react';

export function BecomeReviewerCTA() {
    return (
        <Card className="bg-secondary/50 border-accent/20 shadow-lg">
            <div className="grid md:grid-cols-2 items-center">
                 <CardHeader>
                    <CardTitle className="text-2xl font-headline text-accent">Share Your Theatre Insights</CardTitle>
                    <CardDescription className="text-muted-foreground mt-4 space-y-3">
                        <p>
                        Love theatre? Share your perspective and help fellow audience members discover great shows.
                        </p>
                        <p>
                        Every voice matters. Write a review for any performance you've attended recently.
                        </p>
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 md:pt-0 flex items-center justify-center">
                    <WriteReviewFlow 
                        trigger={
                            <Button size="lg" className="w-full max-w-xs">
                                <PenTool className="mr-2 h-4 w-4" />
                                Write a Review
                            </Button>
                        }
                    />
                </CardContent>
            </div>
        </Card>
    );
}

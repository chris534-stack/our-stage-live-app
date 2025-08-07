'use client';

import { useState, useTransition } from 'react';
import type { Review } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Type, Minus, Plus } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { voteOnReviewAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import SignInPromptModal from '@/components/SignInPromptModal';
import Link from 'next/link';

type FontSize = 'small' | 'medium' | 'large';

interface ReviewSectionProps {
    title: string;
    content: React.ReactNode;
    fontSize: FontSize;
}

function ReviewSection({ title, content, fontSize }: ReviewSectionProps) {
    if (!content) return null;
    
    const titleSizeClasses = {
        small: 'text-sm',
        medium: 'text-base',
        large: 'text-lg'
    };
    
    const contentSizeClasses = {
        small: 'text-sm',
        medium: 'text-base',
        large: 'text-lg'
    };
    
    return (
        <div className="space-y-2">
            <h4 className={cn("font-semibold text-foreground", titleSizeClasses[fontSize])}>
                {title}
            </h4>
            <p className={cn(
                "text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed",
                contentSizeClasses[fontSize]
            )}>
                {content}
            </p>
        </div>
    )
}

interface FontSizeControlsProps {
    fontSize: FontSize;
    onFontSizeChange: (size: FontSize) => void;
}

function FontSizeControls({ fontSize, onFontSizeChange }: FontSizeControlsProps) {
    return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Text Size:</span>
            <div className="flex items-center gap-1">
                <Button
                    variant={fontSize === 'small' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onFontSizeChange('small')}
                >
                    <Minus className="h-3 w-3" />
                </Button>
                <Button
                    variant={fontSize === 'medium' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onFontSizeChange('medium')}
                >
                    A
                </Button>
                <Button
                    variant={fontSize === 'large' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onFontSizeChange('large')}
                >
                    <Plus className="h-3 w-3" />
                </Button>
            </div>
        </div>
    )
}

export function ReviewCard({ review, hideHeader = false }: { review: Review, hideHeader?: boolean }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [localLikes, setLocalLikes] = useState(review.likes || 0);
    const [localDislikes, setLocalDislikes] = useState(review.dislikes || 0);
    const [voted, setVoted] = useState<'like' | 'dislike' | null>(null);
    const [showSignInModal, setShowSignInModal] = useState(false);
    const [fontSize, setFontSize] = useState<FontSize>('medium');

    const handleVote = (voteType: 'like' | 'dislike') => {
        if (!user) {
            setShowSignInModal(true);
            return;
        }

        if (voted || (review.votedBy || []).includes(user.uid)) {
            toast({
                title: "Already Voted",
                description: "You can only vote once per review."
            });
            return;
        }
        
        setVoted(voteType);
        if (voteType === 'like') {
            setLocalLikes(p => p + 1);
        } else {
            setLocalDislikes(p => p + 1);
        }

        startTransition(async () => {
            await voteOnReviewAction(review.id, voteType, user.uid);
            // No need to toast success, it's an implicit action
        });
    }

    const hasVoted = voted || (user && (review.votedBy || []).includes(user.uid));

    return (
        <>
            <Card>
                {!hideHeader && (
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-base">
                                     <Link href={`/profile/${review.reviewerId}`} className="hover:underline">
                                        {review.reviewerName}
                                    </Link>
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    Reviewed performance on {new Date(review.performanceDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                                </CardDescription>
                            </div>
                            <Badge variant="secondary">{review.overallExperience}</Badge>
                        </div>
                    </CardHeader>
                )}
                <CardContent className={cn("space-y-6", hideHeader && "pt-6")}>
                    {/* Font Size Controls */}
                    <FontSizeControls fontSize={fontSize} onFontSizeChange={setFontSize} />
                    
                    {/* Recommendations */}
                    <div className="flex flex-wrap gap-2">
                        {review.recommendations?.map(rec => <Badge key={rec} variant="outline">{rec}</Badge>)}
                    </div>

                    {/* Review Content */}
                    <div className="space-y-6">
                        <ReviewSection 
                            title="What made this performance special?" 
                            content={review.specialMomentsText} 
                            fontSize={fontSize}
                        />
                        <ReviewSection 
                            title="The Heart of the Show" 
                            content={review.showHeartText} 
                            fontSize={fontSize}
                        />
                        <ReviewSection 
                            title="Is this show important for Eugene right now?" 
                            content={review.communityImpactText} 
                            fontSize={fontSize}
                        />
                        
                        <Separator className="my-6" />

                        <ReviewSection 
                            title="Ticket & Seat Info" 
                            content={review.ticketInfo} 
                            fontSize={fontSize}
                        />
                        <ReviewSection 
                            title="Production Value & Admission" 
                            content={review.valueConsiderationText} 
                            fontSize={fontSize}
                        />
                        <ReviewSection 
                            title="A Rewarding Evening?" 
                            content={review.timeWellSpentText} 
                            fontSize={fontSize}
                        />
                        
                        {review.disclosureText && (
                            <>
                                <Separator className="my-6" />
                                <ReviewSection 
                                    title="Transparency Disclosure" 
                                    content={review.disclosureText} 
                                    fontSize={fontSize}
                                />
                            </>
                        )}
                    </div>

                </CardContent>
                <CardFooter className="flex justify-end items-center gap-4">
                    <span className="text-sm text-muted-foreground">Helpful?</span>
                    <Button 
                        variant={voted === 'like' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => handleVote('like')} 
                        disabled={isPending || !!hasVoted}
                    >
                        <ThumbsUp className="mr-2 h-4 w-4" /> {localLikes}
                    </Button>
                    <Button 
                        variant={voted === 'dislike' ? 'destructive' : 'outline'} 
                        size="sm" 
                        onClick={() => handleVote('dislike')}
                        disabled={isPending || !!hasVoted}
                    >
                        <ThumbsDown className="mr-2 h-4 w-4" /> {localDislikes}
                    </Button>
                </CardFooter>
            </Card>
            <SignInPromptModal
                isOpen={showSignInModal}
                onClose={() => setShowSignInModal(false)}
                title="Login Required"
                description="You must be signed in to vote on reviews."
            />
        </>
    );
}

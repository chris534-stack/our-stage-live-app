'use client';

import type { Review } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { toTitleCase } from '@/lib/utils';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState } from 'react';
import type { UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function ReviewPreviewCard({ review }: { review: Review }) {
    const [reviewerProfile, setReviewerProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [profileFetchingDisabled, setProfileFetchingDisabled] = useState(false);
    
    const snippet = review.specialMomentsText.length > 150 
        ? review.specialMomentsText.substring(0, 150) + '...'
        : review.specialMomentsText;

    const formattedDate = new Date(review.performanceDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    });
    
    // Fetch the reviewer's profile to get their photo URL
    useEffect(() => {
        // Skip fetching if it's been disabled due to permission errors
        if (profileFetchingDisabled) {
            setIsLoading(false);
            // Use what we have from the review itself
            setReviewerProfile({
                userId: review.reviewerId,
                displayName: review.reviewerName,
                photoURL: '', // We won't have a photo URL
                email: ''
            } as UserProfile);
            return;
        }
        
        async function fetchReviewerProfile() {
            setIsLoading(true);
            try {
                // Try to get the user profile from Firestore
                const profileRef = doc(db, 'userProfiles', review.reviewerId);
                const profileSnap = await getDoc(profileRef);
                
                if (profileSnap.exists()) {
                    const profileData = profileSnap.data() as UserProfile;
                    console.log('Profile found:', profileData);
                    // Ensure photoURL is properly formatted
                    let photoURL = profileData.photoURL || '';
                    if (photoURL) {
                        console.log('Raw photoURL:', photoURL);
                    }
                    // Ensure we have at least basic profile info
                    setReviewerProfile({
                        ...profileData, // Spread first to get all properties
                        // Then override with fallbacks if needed
                        userId: review.reviewerId,
                        displayName: profileData.displayName || review.reviewerName,
                        photoURL: photoURL,
                        email: profileData.email || ''
                    });
                    console.log('Set reviewer profile with photoURL:', photoURL);
                } else {
                    // If no profile exists, create a minimal profile with available data
                    setReviewerProfile({
                        userId: review.reviewerId,
                        displayName: review.reviewerName,
                        photoURL: '',  // No photo URL available
                        email: ''  // No email available
                    } as UserProfile);
                }
            } catch (error: any) {
                console.error('Error fetching reviewer profile:', error);
                
                // Specifically check for permission errors to avoid repeated attempts
                if (error.code === 'permission-denied' || 
                    error.message?.includes('Missing or insufficient permissions')) {
                    console.warn('Permission denied when fetching profiles. Disabling profile fetching.');
                    // Disable further fetching attempts to avoid console spam
                    setProfileFetchingDisabled(true);
                }
                
                // Even on error, set a minimal profile to ensure component renders
                setReviewerProfile({
                    userId: review.reviewerId,
                    displayName: review.reviewerName,
                    photoURL: '',
                    email: ''
                } as UserProfile);
            } finally {
                setIsLoading(false);
            }
        }
        
        fetchReviewerProfile();
    }, [review.reviewerId, review.reviewerName, profileFetchingDisabled]);
    
    // Get reviewer's initials for avatar fallback
    const getInitials = () => {
        const nameParts = review.reviewerName.split(' ');
        if (nameParts.length >= 2) {
            return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
        }
        return review.reviewerName.substring(0, 2).toUpperCase();
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                 <Card className="flex flex-col w-[400px] h-[260px] cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex gap-3 items-start flex-1">
                                <Link 
                                    href={`/profile/${review.reviewerId}`} 
                                    className="shrink-0" 
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`${review.reviewerName}'s profile`}
                                >
                                    <Avatar className="h-9 w-9 border border-border">
                                        <AvatarImage 
                                            src={reviewerProfile?.photoURL} 
                                            alt={review.reviewerName}
                                            onError={() => console.log('Image failed to load:', reviewerProfile?.photoURL)}
                                        />
                                        <AvatarFallback>{getInitials()}</AvatarFallback>
                                    </Avatar>
                                </Link>
                                <div>
                                    <CardTitle className="text-base font-semibold">
                                        <Link href={`/profile/${review.reviewerId}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                            {review.reviewerName}
                                        </Link>
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-1">
                                        Reviewed on {formattedDate}
                                    </CardDescription>
                                </div>
                            </div>
                            <Badge variant="secondary" className="text-center shrink-0">{review.overallExperience}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground italic">"{snippet}"</p>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <ThumbsUp className="h-4 w-4"/> {review.likes || 0}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <ThumbsDown className="h-4 w-4"/> {review.dislikes || 0}
                            </span>
                        </div>
                        <span className="font-semibold text-primary">Read More &rarr;</span>
                    </CardFooter>
                </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[725px]">
                <DialogHeader>
                    <DialogTitle>Review for {toTitleCase(review.showTitle)}</DialogTitle>
                    <DialogDescription className="flex items-center gap-3">
                        <Link 
                            href={`/profile/${review.reviewerId}`}
                            className="shrink-0" 
                            aria-label={`${review.reviewerName}'s profile`}
                        >
                            <Avatar className="h-8 w-8 border border-border">
                                <AvatarImage 
                                    src={reviewerProfile?.photoURL} 
                                    alt={review.reviewerName} 
                                />
                                <AvatarFallback>{getInitials()}</AvatarFallback>
                            </Avatar>
                        </Link>
                        By <Link href={`/profile/${review.reviewerId}`} className="font-semibold text-primary hover:underline">{review.reviewerName}</Link>. Performance on {formattedDate}.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[85vh] overflow-y-auto pr-6">
                    <ReviewCard review={review} hideHeader />
                </div>
            </DialogContent>
        </Dialog>
    );
}

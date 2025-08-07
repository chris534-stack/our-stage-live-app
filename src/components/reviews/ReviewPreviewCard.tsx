'use client';

import type { Review } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getOptimizedProfilePhoto } from '@/lib/image-utils';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { toTitleCase } from '@/lib/utils';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState, useTransition } from 'react';
import type { UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { deleteReviewAction, flagReviewForRevisionAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Flag, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function ReviewPreviewCard({ review }: { review: Review }) {
    const { isAdmin } = useAuth();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [reviewerProfile, setReviewerProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [profileFetchingDisabled, setProfileFetchingDisabled] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showFlagDialog, setShowFlagDialog] = useState(false);
    const [flagReason, setFlagReason] = useState('');
    
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
                if (!db) {
    setIsLoading(false);
    setReviewerProfile({
        userId: review.reviewerId,
        displayName: review.reviewerName,
        photoURL: '',
        email: ''
    } as UserProfile);
    return;
}
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
    
    const handleDeleteReview = () => {
        startTransition(async () => {
            const result = await deleteReviewAction(review.id);
            if (result.success) {
                toast({ title: 'Success', description: 'Review deleted successfully.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
            setShowDeleteDialog(false);
        });
    };
    
    const handleFlagReview = () => {
        if (!flagReason.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please provide a reason for flagging.' });
            return;
        }
        
        startTransition(async () => {
            const result = await flagReviewForRevisionAction(review.id, flagReason);
            if (result.success) {
                toast({ title: 'Success', description: 'Review flagged for revision successfully.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
            setShowFlagDialog(false);
            setFlagReason('');
        });
    };

    return (
        <>
        <Dialog>
            <DialogTrigger asChild>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow duration-200 flex flex-col w-full min-h-[240px] sm:h-[260px] sm:w-[340px]">
                    <CardHeader className="flex-shrink-0 pb-3 px-4 pt-4">
                        <div className="flex items-start gap-3">
                            <Link 
                                href={`/profile/${review.reviewerId}`}
                                className="shrink-0" 
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`${review.reviewerName}'s profile`}
                            >
                                <Avatar className="h-10 w-10 sm:h-11 sm:w-11 border border-border">
                                    <AvatarImage 
                                        src={getOptimizedProfilePhoto(reviewerProfile?.photoURL, 'avatar')} 
                                        alt={review.reviewerName}
                                        onError={() => console.log('Image failed to load:', reviewerProfile?.photoURL)}
                                    />
                                    <AvatarFallback className="text-sm font-semibold">{getInitials()}</AvatarFallback>
                                </Avatar>
                            </Link>
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-sm sm:text-base font-semibold leading-tight">
                                        <Link href={`/profile/${review.reviewerId}`} className="hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                                            {review.reviewerName}
                                        </Link>
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Reviewed on {formattedDate}
                                    </CardDescription>
                                </div>
                                <Badge variant="secondary" className="text-xs px-2 py-1 bg-primary/10 text-primary font-medium w-fit">
                                    {review.overallExperience}
                                </Badge>
                            </div>
                            
                            {/* Admin Controls */}
                            {isAdmin && (
                                <div className="flex-shrink-0">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 w-8 p-0 hover:bg-muted"
                                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                                <span className="sr-only">Open menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuItem 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowFlagDialog(true);
                                                }}
                                                disabled={isPending}
                                            >
                                                <Flag className="mr-2 h-4 w-4" />
                                                Flag for Revision
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowDeleteDialog(true);
                                                }}
                                                disabled={isPending}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete Review
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow px-4 py-3">
                        <p className="text-sm text-muted-foreground italic leading-relaxed">"{snippet}"</p>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center text-xs text-muted-foreground pt-4 px-4 pb-5">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <span className="flex items-center gap-1.5">
                                <ThumbsUp className="h-3 w-3 sm:h-4 sm:w-4"/> {review.likes || 0}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <ThumbsDown className="h-3 w-3 sm:h-4 sm:w-4"/> {review.dislikes || 0}
                            </span>
                        </div>
                        <span className="font-semibold text-primary text-xs sm:text-sm">Read More &rarr;</span>
                    </CardFooter>
                </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[95vh] flex flex-col">
                <DialogHeader className="space-y-4 pb-4 border-b">
                    <DialogTitle className="text-xl sm:text-2xl font-headline">
                        Review for {toTitleCase(review.showTitle)}
                    </DialogTitle>
                    <CardHeader className="pb-3 px-4 pt-4">
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="space-y-1">
                                    <Link 
                                        href={`/profile/${review.reviewerId}`} 
                                        className="font-semibold text-sm sm:text-base text-foreground hover:text-primary transition-colors block"
                                    >
                                        {review.reviewerName}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        Reviewed on {formattedDate}
                                    </p>
                                </div>
                                
                                <Badge 
                                    variant="secondary" 
                                    className="text-xs px-2 py-1 bg-primary/10 text-primary font-medium w-fit"
                                >
                                    {review.overallExperience}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>        
                    <div className="text-sm text-muted-foreground space-y-1">
                        <p className="font-medium">Performance on {formattedDate}</p>
                        <p className="text-xs">Tap the reviewer's name or photo to view their profile</p>
                    </div>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto px-1 sm:px-2">
                    <div className="py-4">
                        <ReviewCard review={review} hideHeader />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
        
        {/* Admin Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Review</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this review by {review.reviewerName}? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDeleteReview}
                        disabled={isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isPending ? 'Deleting...' : 'Delete Review'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        
        {/* Admin Flag for Revision Dialog */}
        <AlertDialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Flag Review for Revision</AlertDialogTitle>
                    <AlertDialogDescription>
                        Please provide a reason for flagging this review. The reviewer will be notified and asked to revise their review.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <textarea 
                        value={flagReason}
                        onChange={(e) => setFlagReason(e.target.value)}
                        placeholder="Enter reason for flagging (e.g., inappropriate content, needs more detail, etc.)"
                        className="w-full p-3 border rounded-md resize-none h-24 text-sm"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleFlagReview}
                        disabled={isPending || !flagReason.trim()}
                    >
                        {isPending ? 'Flagging...' : 'Flag for Revision'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

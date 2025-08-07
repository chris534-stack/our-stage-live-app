

'use server';

import { revalidatePath } from 'next/cache';
import { addEvent, eventExists, addNewsArticle } from '@/lib/data';
import { adminDb, admin } from '@/lib/firebase-admin';
import type { Event, EventOccurrence, NewsArticle, Review, Venue, UserProfile } from '@/lib/types';
import { scrapeEventDetails } from '@/ai/flows/scrape-event-details';
import { scrapeArticle } from '@/ai/flows/scrape-article';


export async function revalidateAdminPaths() {
  revalidatePath('/admin');
  revalidatePath('/calendar');
  revalidatePath('/');
  revalidatePath('/about-us');
}

export async function scrapeEventAction(url: string | undefined, screenshotDataUri: string) {
  try {
    const scrapedData = await scrapeEventDetails({ url, screenshotDataUri });
    return { success: true, data: { ...scrapedData, sourceUrl: url } };
  } catch (error) {
    console.error('Scraping failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `An unexpected error occurred while scraping the event details. Error: ${errorMessage}` };
  }
}

interface EventFormData {
  title: string;
  description?: string;
  url?: string;
  venueId: string;
  type: string;
  tags?: string[];
  occurrences: EventOccurrence[];
}

export async function addEventFromFormAction(data: EventFormData) {
  try {
    const { title, venueId } = data;
    const alreadyExists = await eventExists(title, venueId);
    if (alreadyExists) {
        return { success: false, message: `This event ("${title}") already exists in the system for this venue.` };
    }

    const newEvent: Omit<Event, 'id'> = {
      ...data,
      description: data.description || '',
      tags: data.tags || [],
      status: 'approved',
    };

    await addEvent(newEvent);
    await revalidateAdminPaths();
    return { success: true, message: 'Event added and approved successfully.' };

  } catch (error) {
    console.error('Failed to add event:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
  }
}


export async function updateEventAction(eventId: string, data: EventFormData) {
  try {
    // Sanitize data: Firestore throws an error if any field value is `undefined`.
    // We create a new object and only add fields that have a defined value.
    const cleanData: { [key: string]: any } = {};
    for (const key in data) {
      if (data[key as keyof EventFormData] !== undefined) {
        cleanData[key] = data[key as keyof EventFormData];
      }
    }
    // Ensure description and URL are at least an empty string if they're not provided
    cleanData.description = cleanData.description || '';
    cleanData.url = cleanData.url || '';
    cleanData.tags = cleanData.tags || [];


    const eventRef = adminDb.collection('events').doc(eventId);
    await eventRef.update(cleanData);

    await revalidateAdminPaths();
    return { success: true, message: 'Event updated successfully.' };
  } catch (error) {
    console.error('Failed to update event:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
  }
}

export async function updateEventStatusAction(eventId: string, status: 'approved' | 'denied') {
    try {
        const eventRef = adminDb.collection('events').doc(eventId);
        await eventRef.update({ status });
        await revalidateAdminPaths();
        return { success: true, message: `Event status updated to ${status}.` };
    } catch (error) {
        console.error('Failed to update event status:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function deleteEventAction(eventId: string) {
    try {
        await adminDb.collection('events').doc(eventId).delete();
        await revalidateAdminPaths();
        return { success: true, message: 'Event deleted successfully.' };
    } catch (error) {
        console.error('Failed to delete event:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function updateVenueAction(venueId: string, data: Partial<Omit<Venue, 'id'>>) {
    try {
        await adminDb.collection('venues').doc(venueId).update(data);
        await revalidateAdminPaths();
        return { success: true, message: 'Venue updated successfully.' };
    } catch (error) {
        console.error('Failed to update venue:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function deleteVenueAction(venueId: string) {
    try {
        await adminDb.collection('venues').doc(venueId).delete();
        await revalidateAdminPaths();
        return { success: true, message: 'Venue deleted successfully.' };
    } catch (error) {
        console.error('Failed to delete venue:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function scrapeArticleAction(url: string) {
    try {
        const articleData = await scrapeArticle({ url });

        if (!articleData.title || !articleData.summary) {
            return { success: false, message: 'The AI could not extract a title and summary from the article.' };
        }
        
        return { success: true, data: { ...articleData, url } };

    } catch (error) {
        console.error('Failed to scrape article:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

interface ArticleFormData {
  url: string;
  title: string;
  summary: string;
  imageUrl?: string;
}

export async function saveNewsArticleAction(data: ArticleFormData) {
    try {
        const newArticleData = {
            ...data,
            createdAt: new Date().toISOString(),
            order: 0, // Default order, will be updated if needed
        };

        const newsCollection = adminDb.collection('news');
        const snapshot = await newsCollection.orderBy('order', 'desc').limit(1).get();
        if (!snapshot.empty) {
            const lastArticle = snapshot.docs[0].data();
            newArticleData.order = (lastArticle.order || 0) + 1;
        }

        await addNewsArticle(newArticleData as Omit<NewsArticle, 'id'>);
        revalidatePath('/news');
        return { success: true, message: 'Article added successfully.' };
    } catch (error) {
        console.error('Failed to add news article:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function updateNewsArticleOrderAction(orderedArticleIds: string[]) {
    try {
        const batch = adminDb.batch();
        const newsCollection = adminDb.collection('news');

        orderedArticleIds.forEach((id, index) => {
            const docRef = newsCollection.doc(id);
            batch.update(docRef, { order: index });
        });

        await batch.commit();
        revalidatePath('/news');
        return { success: true, message: 'Article order updated.' };
    } catch (error) {
        console.error('Failed to update article order:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function addListingRequestAction(data: {
    organizationName: string;
    contactName: string;
    contactEmail: string;
    websiteUrl?: string;
    message?: string;
}) {
    try {
        const requestData = {
            ...data,
            status: 'new',
            createdAt: new Date().toISOString(),
        };

        await adminDb.collection('listingRequests').add(requestData);
        
        return { success: true, message: 'Request submitted successfully.' };

    } catch (error) {
        console.error('Failed to submit listing request:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function submitReviewAction(data: Omit<Review, 'id' | 'createdAt' | 'likes' | 'dislikes' | 'votedBy'>) {
    try {
        const reviewData = {
            ...data,
            likes: 0,
            dislikes: 0,
            votedBy: [],
            createdAt: new Date().toISOString(),
        };

        await adminDb.collection('reviews').add(reviewData);

        revalidatePath('/calendar');
        revalidatePath('/reviews');
        revalidatePath(`/profile/${data.reviewerId}`);
        return { success: true, message: 'Your review has been submitted. Thank you!' };
    } catch (error) {
        console.error('Failed to submit review:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function voteOnReviewAction(reviewId: string, voteType: 'like' | 'dislike', userId: string) {
    if (!userId) {
        return { success: false, message: 'You must be logged in to vote.' };
    }

    const reviewRef = adminDb.collection('reviews').doc(reviewId);

    try {
        await adminDb.runTransaction(async (transaction) => {
            const reviewDoc = await transaction.get(reviewRef);
            if (!reviewDoc.exists) {
                throw new Error("Review not found.");
            }

            const reviewData = reviewDoc.data() as Review;
            
            if (reviewData.votedBy?.includes(userId)) {
                // User has already voted, we don't return an error message to the UI
                // to avoid letting them know they can't vote again. Just do nothing.
                return;
            }

            const newVotedBy = [...(reviewData.votedBy || []), userId];
            const newLikes = voteType === 'like' ? (reviewData.likes || 0) + 1 : (reviewData.likes || 0);
            const newDislikes = voteType === 'dislike' ? (reviewData.dislikes || 0) + 1 : (reviewData.dislikes || 0);

            transaction.update(reviewRef, {
                likes: newLikes,
                dislikes: newDislikes,
                votedBy: newVotedBy,
            });
        });
        
        revalidatePath('/calendar');
        revalidatePath('/reviews');
        return { success: true };

    } catch (error) {
        console.error('Failed to vote on review:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function requestToBeReviewerAction(data: {
    userId: string;
    userName: string;
    userEmail: string;
}) {
    try {
        const requestData = {
            ...data,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        await adminDb.collection('reviewerRequests').add(requestData);
        
        return { success: true, message: 'Request submitted successfully.' };

    } catch (error) {
        console.error('Failed to submit reviewer request:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

// --- User Profile Actions ---

export async function updateUserProfileAction(userId: string, data: Partial<UserProfile>) {
    try {
        // Sanitize data to prevent `undefined` values being sent to Firestore
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined)
        );
        
        await adminDb.collection('userProfiles').doc(userId).update(cleanData);

        // Revalidate paths where this profile might be displayed
        revalidatePath(`/profile/${userId}`);
        revalidatePath('/reviews');
        revalidatePath('/calendar');
        
        return { success: true, message: 'Profile updated successfully.' };
    } catch (error) {
        console.error('Failed to update user profile:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function uploadProfilePhotoAction(formData: FormData) {
    const file = formData.get('photo') as File;
    const userId = formData.get('userId') as string;
    const GALLERY_PHOTO_LIMIT = 50;

    if (!file || !userId) {
        return { success: false, message: 'Missing file or user ID.' };
    }
    
    // This is the critical change: check for the server-side variable first.
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!storageBucket) {
        console.error('Server configuration error: FIREBASE_STORAGE_BUCKET is not set.');
        // This is a user-friendly error that prevents a server crash.
        return { success: false, message: 'Server configuration error: Storage destination not found.' };
    }

    const profileRef = adminDb.collection('userProfiles').doc(userId);

    try {
        const docSnap = await profileRef.get();
        if (docSnap.exists) {
            const profileData = docSnap.data() as UserProfile;
            const currentPhotoCount = profileData.galleryImageUrls?.length || 0;
            if (currentPhotoCount >= GALLERY_PHOTO_LIMIT) {
                return { success: false, message: `You have reached the photo limit of ${GALLERY_PHOTO_LIMIT}.` };
            }
        }

        const bucket = admin.storage().bucket(storageBucket);
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${userId}/${Date.now()}-${file.name}`;
        const fileUpload = bucket.file(fileName);

        await fileUpload.save(buffer, {
            metadata: {
                contentType: file.type,
            },
        });

        // Make the file public to get a URL
        await fileUpload.makePublic();
        const publicUrl = fileUpload.publicUrl();

        // Update user profile in Firestore (create document if it doesn't exist)
        await profileRef.set({
            galleryImageUrls: admin.firestore.FieldValue.arrayUnion(publicUrl),
        }, { merge: true });

        revalidatePath(`/profile/${userId}`);

        return { success: true };
    } catch (error) {
        console.error('Failed to upload photo:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Upload failed: ${errorMessage}` };
    }
}

export async function uploadMultiplePhotosAction(
    formData: FormData, 
    onProgress?: (progress: number) => void
) {
    const userId = formData.get('userId') as string;
    const files = formData.getAll('photos') as File[];
    const GALLERY_PHOTO_LIMIT = 50;

    if (!files || files.length === 0 || !userId) {
        return { success: false, message: 'Missing files or user ID.' };
    }

    // Check storage bucket configuration
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!storageBucket) {
        console.error('Server configuration error: FIREBASE_STORAGE_BUCKET is not set.');
        return { success: false, message: 'Server configuration error: Storage destination not found.' };
    }

    const profileRef = adminDb.collection('userProfiles').doc(userId);

    try {
        // Check current photo count
        const docSnap = await profileRef.get();
        let currentPhotoCount = 0;
        if (docSnap.exists) {
            const profileData = docSnap.data() as UserProfile;
            currentPhotoCount = profileData.galleryImageUrls?.length || 0;
        }

        // Check if adding these files would exceed the limit
        if (currentPhotoCount + files.length > GALLERY_PHOTO_LIMIT) {
            const remainingSlots = GALLERY_PHOTO_LIMIT - currentPhotoCount;
            return { 
                success: false, 
                message: `Cannot upload ${files.length} photos. You can only add ${remainingSlots} more photo${remainingSlots !== 1 ? 's' : ''} (limit: ${GALLERY_PHOTO_LIMIT}).` 
            };
        }

        const bucket = admin.storage().bucket(storageBucket);
        const uploadedUrls: string[] = [];
        const errors: string[] = [];

        // Process files in batches to avoid overwhelming the system
        const batchSize = 5;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (file, batchIndex) => {
                try {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
                    const fileUpload = bucket.file(fileName);

                    await fileUpload.save(buffer, {
                        metadata: {
                            contentType: file.type,
                        },
                    });

                    // Make the file public
                    await fileUpload.makePublic();
                    const publicUrl = fileUpload.publicUrl();
                    
                    return { success: true as const, url: publicUrl, fileName: file.name };
                } catch (error) {
                    console.error(`Failed to upload ${file.name}:`, error);
                    return { 
                        success: false as const, 
                        error: error instanceof Error ? error.message : String(error),
                        fileName: file.name 
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            // Process batch results
            batchResults.forEach((result) => {
                if (result.success) {
                    uploadedUrls.push(result.url);
                } else {
                    errors.push(`${result.fileName}: ${result.error}`);
                }
            });

            // Update progress
            if (onProgress) {
                const progress = Math.round(((i + batch.length) / files.length) * 100);
                onProgress(progress);
            }
        }

        // Update Firestore with successfully uploaded URLs
        if (uploadedUrls.length > 0) {
            await profileRef.set({
                galleryImageUrls: admin.firestore.FieldValue.arrayUnion(...uploadedUrls),
            }, { merge: true });
        }

        revalidatePath(`/profile/${userId}`);

        // Return results
        if (uploadedUrls.length === files.length) {
            return { success: true, message: `Successfully uploaded ${uploadedUrls.length} photos.` };
        } else if (uploadedUrls.length > 0) {
            return { 
                success: true, 
                message: `Uploaded ${uploadedUrls.length} of ${files.length} photos. ${errors.length} failed: ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? '...' : ''}` 
            };
        } else {
            return { 
                success: false, 
                message: `All uploads failed. Errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}` 
            };
        }
    } catch (error) {
        console.error('Failed to upload multiple photos:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Upload failed: ${errorMessage}` };
    }
}

export async function updateGalleryOrderAction(userId: string, orderedUrls: string[]) {
    try {
        const profileRef = adminDb.collection('userProfiles').doc(userId);
        await profileRef.update({
            galleryImageUrls: orderedUrls,
        });

        revalidatePath(`/profile/${userId}`);
        return { success: true, message: 'Gallery order updated successfully.' };
    } catch (error) {
        console.error('Failed to update gallery order:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function deleteProfilePhotoAction(userId: string, photoUrl: string) {
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!storageBucket) {
        console.error('Server configuration error: FIREBASE_STORAGE_BUCKET is not set.');
        return { success: false, message: 'Server configuration error: Storage destination not found.' };
    }

    try {
        const bucket = admin.storage().bucket(storageBucket);
        
        // Extract the file path from the Google Cloud Storage public URL
        let filePath: string;
        
        console.log('=== IMAGE DELETION DEBUG ===');
        console.log('User ID:', userId);
        console.log('Photo URL:', photoUrl);
        
        try {
            const url = new URL(photoUrl);
            console.log('Parsed URL:', {
                hostname: url.hostname,
                pathname: url.pathname,
                search: url.search,
                full: url.toString()
            });
            
            // Handle different Firebase Storage URL formats
            if (url.hostname === 'storage.googleapis.com') {
                // Format: https://storage.googleapis.com/bucket-name/path/to/file
                const pathParts = url.pathname.split('/').filter(part => part.length > 0);
                console.log('storage.googleapis.com format detected');
                console.log('Path parts:', pathParts);
                
                if (pathParts.length >= 2) {
                    filePath = decodeURIComponent(pathParts.slice(1).join('/'));
                    console.log('Extracted file path:', filePath);
                } else {
                    throw new Error('Invalid URL format: insufficient path parts');
                }
            } else if (url.hostname.includes('firebasestorage.googleapis.com') || url.hostname.endsWith('.firebasestorage.app')) {
                // Format: https://firebasestorage.googleapis.com/v0/b/bucket-name/o/encoded-path?alt=media
                console.log('Firebase Storage hosted URL detected');
                if (url.hostname.includes('firebasestorage.googleapis.com')) {
                    // Format: https://firebasestorage.googleapis.com/v0/b/bucket-name/o/encoded-path?alt=media
                    const pathMatch = url.pathname.match(/\/o\/(.+)$/);
                    console.log('Path match result:', pathMatch);

                    if (pathMatch) {
                        filePath = decodeURIComponent(pathMatch[1]);
                        console.log('Extracted file path:', filePath);
                    } else {
                        throw new Error('Invalid Firebase Storage URL format');
                    }
                } else {
                    // Format: https://<bucket>.firebasestorage.app/path/to/file
                    filePath = decodeURIComponent(url.pathname.slice(1)); // remove leading '/'
                    console.log('firebasestorage.app format detected');
                    console.log('Extracted file path:', filePath);
                }
            } else {
                throw new Error(`Unsupported storage hostname: ${url.hostname}`);
            }
            
            console.log('Security check - filePath:', filePath);
            console.log('Security check - expected prefix:', `${userId}/`);
            console.log('Security check - starts with user ID:', filePath.startsWith(`${userId}/`));
            
            // Security check to ensure we're not deleting files outside the user's folder
            if (!filePath || !filePath.startsWith(`${userId}/`)) {
                throw new Error(`Invalid file path for deletion. Path: ${filePath}, Expected to start with: ${userId}/`);
            }
            
            console.log('Security check passed, file path:', filePath);
            
        } catch (error) {
            console.error('Failed to parse photo URL for deletion:', {
                photoUrl,
                userId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error(`Invalid file path for deletion. ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
        }

        const file = bucket.file(filePath);

        // Delete from Firebase Storage
        await file.delete().catch(error => {
            // It's okay if the file doesn't exist, maybe it was already deleted.
            // We'll log other errors but continue, so the DB record is still removed.
            if (error.code !== 404) {
                console.warn(`Firebase Storage deletion warning: ${error.message}`);
            }
        });

        // Remove from Firestore
        const profileRef = adminDb.collection('userProfiles').doc(userId);
        await adminDb.runTransaction(async (transaction) => {
            const freshDoc = await transaction.get(profileRef);
            if (!freshDoc.exists) return; // Profile doesn't exist, nothing to do.

            const freshData = freshDoc.data() as UserProfile;
            const updates: { [key: string]: any } = {
                galleryImageUrls: admin.firestore.FieldValue.arrayRemove(photoUrl),
            };

            if (freshData.coverPhotoUrl === photoUrl) {
                updates.coverPhotoUrl = '';
            }
            if (freshData.photoURL === photoUrl) {
                // If the user's main profile pic was deleted, revert to their Google photo or blank
                try {
                    const userRecord = await admin.auth().getUser(userId);
                    updates.photoURL = userRecord.photoURL || '';
                } catch (authError) {
                    console.warn(`Could not find auth user ${userId} when deleting photo. Setting photoURL to empty.`)
                    updates.photoURL = '';
                }
            }
            transaction.update(profileRef, updates);
        });

        revalidatePath(`/profile/${userId}`);
        return { success: true, message: 'Photo deleted successfully.' };

    } catch (error) {
        console.error('Failed to delete photo:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}


export async function setProfilePhotoAction(userId: string, photoUrl: string) {
    try {
        const profileRef = adminDb.collection('userProfiles').doc(userId);
        await profileRef.set({ photoURL: photoUrl }, { merge: true });

        revalidatePath(`/profile/${userId}`);
        return { success: true, message: 'Profile photo updated successfully.' };
    } catch (error) {
        console.error('Failed to set profile photo:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function setCoverPhotoAction(userId: string, photoUrl: string) {
    try {
        const profileRef = adminDb.collection('userProfiles').doc(userId);
        await profileRef.set({ coverPhotoUrl: photoUrl }, { merge: true });

        revalidatePath(`/profile/${userId}`);
        return { success: true, message: 'Cover photo updated successfully.' };
    } catch (error) {
        console.error('Failed to set cover photo:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

// --- Community Spotlight Actions ---

export async function uploadSpotlightPhotoAction(formData: FormData) {
    const file = formData.get('photo') as File;
    const type = formData.get('type') as string;

    if (!file || !type) {
        return { success: false, message: 'Missing file or type.' };
    }
    
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!storageBucket) {
        console.error('Server configuration error: FIREBASE_STORAGE_BUCKET is not set.');
        return { success: false, message: 'Server configuration error: Storage destination not found.' };
    }

    try {
        const bucket = admin.storage().bucket(storageBucket);
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `spotlights/${Date.now()}-${file.name}`;
        const fileUpload = bucket.file(fileName);

        await fileUpload.save(buffer, {
            metadata: {
                contentType: file.type,
            },
        });

        // Make the file public to get a URL
        await fileUpload.makePublic();
        const publicUrl = fileUpload.publicUrl();

        return { success: true, url: publicUrl };
    } catch (error) {
        console.error('Failed to upload spotlight photo:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Upload failed: ${errorMessage}` };
    }
}

export async function createSpotlightAction(spotlightData: {
    name: string;
    story: string;
    photoUrl: string;
    tags: string[];
    isActive: boolean;
    links?: {
        website?: string;
        social?: string;
    };
    adminNotes?: string;
}) {
    try {
        const { createSpotlight } = await import('@/lib/data');
        
        const newSpotlight = await createSpotlight({
            ...spotlightData,
            createdAt: new Date().toISOString(),
            createdBy: 'admin', // TODO: Get from session when auth is implemented
        });

        if (!newSpotlight) {
            return { success: false, message: 'Failed to create spotlight.' };
        }

        revalidatePath('/');
        revalidatePath('/admin/spotlights');
        
        return { success: true, spotlight: newSpotlight };
    } catch (error) {
        console.error('Failed to create spotlight:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to create spotlight: ${errorMessage}` };
    }
}

export async function updateSpotlightAction(id: string, updates: {
    name?: string;
    story?: string;
    photoUrl?: string;
    tags?: string[];
    isActive?: boolean;
    links?: {
        website?: string;
        social?: string;
    };
    adminNotes?: string;
}) {
    try {
        const { updateSpotlight, getAllSpotlights } = await import('@/lib/data');
        
        const success = await updateSpotlight(id, updates);
        
        if (!success) {
            return { success: false, message: 'Failed to update spotlight.' };
        }

        // Get the updated spotlight to return
        const allSpotlights = await getAllSpotlights();
        const updatedSpotlight = allSpotlights.find(s => s.id === id);
        
        if (!updatedSpotlight) {
            return { success: false, message: 'Spotlight updated but could not retrieve updated data.' };
        }

        revalidatePath('/');
        revalidatePath('/admin/spotlights');
        
        return { success: true, spotlight: updatedSpotlight };
    } catch (error) {
        console.error('Failed to update spotlight:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to update spotlight: ${errorMessage}` };
    }
}

export async function deleteSpotlightAction(id: string) {
    try {
        const { deleteSpotlight } = await import('@/lib/data');
        
        const success = await deleteSpotlight(id);
        
        if (!success) {
            return { success: false, message: 'Failed to delete spotlight.' };
        }

        revalidatePath('/');
        revalidatePath('/admin/spotlights');
        
        return { success: true };
    } catch (error) {
        console.error('Failed to delete spotlight:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to delete spotlight: ${errorMessage}` };
    }
}

/**
 * Toggle reviewer status for a user (revoke or reinstate reviewer privileges)
 */
export async function toggleReviewerStatusAction(userId: string, isReviewer: boolean) {
    try {
        await adminDb.collection('userProfiles').doc(userId).update({
            isReviewer: isReviewer
        });

        revalidatePath('/admin');
        revalidatePath(`/profile/${userId}`);
        
        const action = isReviewer ? 'granted' : 'revoked';
        return { success: true, message: `Reviewer status ${action} successfully.` };
    } catch (error) {
        console.error('Failed to toggle reviewer status:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to update reviewer status: ${errorMessage}` };
    }
}

/**
 * Delete a review (for moderation purposes)
 */
export async function deleteReviewAction(reviewId: string) {
    try {
        await adminDb.collection('reviews').doc(reviewId).delete();

        revalidatePath('/reviews');
        revalidatePath('/calendar');
        revalidatePath('/admin');
        
        return { success: true, message: 'Review deleted successfully.' };
    } catch (error) {
        console.error('Failed to delete review:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to delete review: ${errorMessage}` };
    }
}

/**
 * Send a review back for revision (mark as needs revision)
 */
export async function flagReviewForRevisionAction(reviewId: string, reason: string) {
    try {
        await adminDb.collection('reviews').doc(reviewId).update({
            flaggedForRevision: true,
            flaggedReason: reason,
            flaggedAt: new Date().toISOString(),
            flaggedBy: 'admin' // TODO: Get from session when auth is implemented
        });

        revalidatePath('/reviews');
        revalidatePath('/calendar');
        revalidatePath('/admin');
        
        return { success: true, message: 'Review flagged for revision successfully.' };
    } catch (error) {
        console.error('Failed to flag review for revision:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to flag review: ${errorMessage}` };
    }
}

/**
 * Clear revision flag from a review
 */
export async function clearReviewRevisionFlagAction(reviewId: string) {
    try {
        await adminDb.collection('reviews').doc(reviewId).update({
            flaggedForRevision: admin.firestore.FieldValue.delete(),
            flaggedReason: admin.firestore.FieldValue.delete(),
            flaggedAt: admin.firestore.FieldValue.delete(),
            flaggedBy: admin.firestore.FieldValue.delete()
        });

        revalidatePath('/reviews');
        revalidatePath('/calendar');
        revalidatePath('/admin');
        
        return { success: true, message: 'Review revision flag cleared successfully.' };
    } catch (error) {
        console.error('Failed to clear review revision flag:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to clear revision flag: ${errorMessage}` };
    }
}

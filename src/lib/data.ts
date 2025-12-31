import { adminDb, admin } from './firebase-admin'; // Admin SDK for server-side functions
import type { Event, Venue, EventStatus, NewsArticle, Review, UserProfile, CommunitySpotlight, ReviewerRequest, EventOccurrence } from './types';
import { startOfToday, addDays, endOfMonth } from 'date-fns';
import type { UserRecord } from 'firebase-admin/auth';

const parseDateString = (dateString: string): Date => {
    // Manually parse date components to avoid timezone shift issues.
    // new Date('YYYY-MM-DD') can be interpreted as UTC midnight.
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const compareOccurrencesAscending = (a: EventOccurrence, b: EventOccurrence): number => {
    const timeA = parseDateString(a.date).getTime();
    const timeB = parseDateString(b.date).getTime();
    if (timeA === timeB) {
        return (a.time || '').localeCompare(b.time || '');
    }
    return timeA - timeB;
};

const collectEventsWithinRange = (
    events: Event[],
    rangeStart: Date,
    rangeEnd: Date
): Event[] => {
    return events
        .map(event => {
            const inRangeOccurrences = (event.occurrences || [])
                .filter(occ => {
                    try {
                        const eventDate = parseDateString(occ.date);
                        return eventDate >= rangeStart && eventDate <= rangeEnd;
                    } catch (e) {
                        return false;
                    }
                })
                .sort(compareOccurrencesAscending);

            if (inRangeOccurrences.length === 0) {
                return null;
            }

            return {
                ...event,
                occurrences: inRangeOccurrences,
            } as Event;
        })
        .filter((event): event is Event => event !== null)
        .sort((a, b) => compareOccurrencesAscending(a.occurrences[0], b.occurrences[0]));
};

/**
 * [SERVER-SIDE] Safely converts a Firestore Timestamp, Date object, or string into a serializable ISO string.
 * Returns a default epoch date string if the input is invalid or null.
 */
function safeToISOString(dateValue: any): string {
    if (!dateValue) {
        return new Date(0).toISOString();
    }
    // Handle Firestore Timestamp
    if (typeof dateValue.toDate === 'function') {
        try {
            return dateValue.toDate().toISOString();
        } catch {
            return new Date(0).toISOString();
        }
    }
    // Handle JS Date object
    if (dateValue instanceof Date) {
        if (!isNaN(dateValue.getTime())) {
            return dateValue.toISOString();
        }
        return new Date(0).toISOString();
    }
    // Handle string or number
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
        try {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                return d.toISOString();
            }
        } catch {
            // new Date() can throw, so we catch it.
        }
    }
    // Fallback for any other type or invalid value
    return new Date(0).toISOString();
}

/**
 * [SERVER-SIDE] Enriches a list of items having a venueId with their corresponding Venue object.
 */
export function enrichEventsWithVenues<T extends { venueId: string }>(
    items: T[],
    venues: Venue[]
): (T & { venue?: Venue })[] {
    const venueMap = new Map(venues.map(v => [v.id, v]));
    return items.map(item => ({
        ...item,
        venue: venueMap.get(item.venueId)
    }));
}


// --- Venue Functions ---

/**
 * [SERVER-SIDE] Fetches all venues using the Admin SDK.
 */
export async function getAllVenues(): Promise<Venue[]> {
    const snapshot = await adminDb.collection('venues').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Venue));
}

/**
 * [SERVER-SIDE] Checks if a venue exists by its document ID.
 */
export async function venueExists(venueId: string): Promise<boolean> {
    if (!venueId) return false;
    try {
        const doc = await adminDb.collection('venues').doc(venueId).get();
        return doc.exists;
    } catch (err) {
        console.error('venueExists failed:', err);
        return false;
    }
}


// --- Event Functions ---

interface GetAllEventsOptions {
    includeOccurrences?: boolean;
}

// Events enriched with creator metadata for admin views
export type EventWithCreator = Event & {
    createdByName?: string;
    createdByIsVenueRep?: boolean;
    createdByEmail?: string;
};

/**
 * [SERVER-SIDE] Fetches all events using the Admin SDK.
 * Can optionally exclude the 'occurrences' field for performance.
 */
export async function getAllEvents(options: GetAllEventsOptions = { includeOccurrences: true }): Promise<Event[]> {
    let query = adminDb.collection('events').select(
        'id', 'title', 'description', 'venueId', 'type', 'tags', 'status', 'url'
    );

    // Only add 'occurrences' to the select statement if needed
    if (options.includeOccurrences) {
        query = adminDb.collection('events').select(
            'id', 'title', 'description', 'venueId', 'type', 'tags', 'status', 'url', 'occurrences'
        );
    }

    const snapshot = await adminDb.collection('events').get();

    const events = snapshot.docs.map(doc => {
        const data = doc.data();
        // Defensively map occurrences to ensure time is always a string.
        const occurrences = (options.includeOccurrences && data.occurrences)
            ? data.occurrences.map((o: any) => ({ date: o.date, time: o.time || '' }))
            : [];

        return {
            id: doc.id,
            title: data.title,
            description: data.description,
            venueId: data.venueId,
            type: data.type,
            tags: data.tags || [],
            status: data.status,
            createdBy: data.createdBy || '',
            url: data.url,
            occurrences: occurrences,
        } as Event;
    });

    // Sort events by the date of their first occurrence if available
    if (options.includeOccurrences) {
        events.sort((a, b) => {
            if (!a.occurrences || a.occurrences.length === 0) return 1;
            if (!b.occurrences || b.occurrences.length === 0) return -1;
            const dateA = parseDateString(a.occurrences[0].date);
            const dateB = parseDateString(b.occurrences[0].date);
            return dateA.getTime() - dateB.getTime();
        });
    }

    return events;
}

/**
 * [SERVER-SIDE] Fetches all events and enriches them with creator profile metadata.
 * Adds createdByName, createdByIsVenueRep, and createdByEmail for admin display/filtering.
 */
export async function getAllEventsWithCreator(options: GetAllEventsOptions = { includeOccurrences: true }): Promise<EventWithCreator[]> {
    // Fetch raw events first
    const snapshot = await adminDb.collection('events').get();

    const events: Event[] = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        const occurrences = (options.includeOccurrences && data.occurrences)
            ? data.occurrences.map((o: any) => ({ date: o.date, time: o.time || '' }))
            : [];
        return {
            id: doc.id,
            title: data.title,
            description: data.description,
            venueId: data.venueId,
            type: data.type,
            tags: data.tags || [],
            status: data.status,
            createdBy: data.createdBy || '',
            url: data.url,
            occurrences,
        } as Event;
    });

    // Sort events by first occurrence date when included
    if (options.includeOccurrences) {
        events.sort((a, b) => {
            if (!a.occurrences || a.occurrences.length === 0) return 1;
            if (!b.occurrences || b.occurrences.length === 0) return -1;
            const dateA = parseDateString(a.occurrences[0].date);
            const dateB = parseDateString(b.occurrences[0].date);
            return dateA.getTime() - dateB.getTime();
        });
    }

    // Build creator metadata map from user profiles
    const profiles = await getAllUserProfiles();
    const profileById = new Map(profiles.map(p => [p.userId, p]));

    // Enrich events with creator metadata
    const enriched: EventWithCreator[] = events.map(e => {
        const p = profileById.get(e.createdBy);
        return {
            ...e,
            createdByName: p?.displayName || undefined,
            createdByIsVenueRep: !!p?.isVenueRep,
            createdByEmail: p?.email || undefined,
        };
    });

    return enriched;
}

/**
 * [SERVER-SIDE] Fetches events by status.
 */
export async function getEventsByStatus(status: EventStatus): Promise<Event[]> {
    const q = adminDb.collection('events').where('status', '==', status);
    const snapshot = await q.get();
    const events = snapshot.docs.map(doc => {
        const data = doc.data();
        // Defensively map occurrences to ensure time is always a string.
        const occurrences = (data.occurrences || []).map((o: any) => ({ date: o.date, time: o.time || '' }));
        return { id: doc.id, ...data, tags: data.tags || [], occurrences } as Event
    });

    // Sort events by the date of their first occurrence
    events.sort((a, b) => {
        if (!a.occurrences || a.occurrences.length === 0) return 1;
        if (!b.occurrences || b.occurrences.length === 0) return -1;
        const dateA = parseDateString(a.occurrences[0].date);
        const dateB = parseDateString(b.occurrences[0].date);
        return dateA.getTime() - dateB.getTime();
    });

    return events;
}

/**
 * [SERVER-SIDE] Fetches featured events for the homepage.
 */
export async function getFeaturedEventsFirestore(count: number): Promise<Event[]> {
    const approvedEvents = await getEventsByStatus("approved");

    const today = startOfToday();
    const endOfCurrentMonth = endOfMonth(today);
    const thirtyDaysFromNow = addDays(today, 30);

    // Debug logging to verify date filtering
    if (process.env.NODE_ENV === 'development') {
        console.log('[getFeaturedEventsFirestore] Today:', today.toISOString());
        console.log('[getFeaturedEventsFirestore] End of month:', endOfCurrentMonth.toISOString());
        console.log('[getFeaturedEventsFirestore] 30 days from now:', thirtyDaysFromNow.toISOString());
        console.log('[getFeaturedEventsFirestore] Total approved events:', approvedEvents.length);
    }

    const currentMonthEvents = collectEventsWithinRange(approvedEvents, today, endOfCurrentMonth);

    if (process.env.NODE_ENV === 'development') {
        console.log('[getFeaturedEventsFirestore] Current month events:', currentMonthEvents.length);
        currentMonthEvents.forEach(e => {
            console.log(`  - ${e.title}: ${e.occurrences?.[0]?.date}`);
        });
    }

    if (currentMonthEvents.length >= count) {
        return currentMonthEvents.slice(0, count);
    }

    const upcomingEvents = collectEventsWithinRange(approvedEvents, today, thirtyDaysFromNow);
    const merged: Event[] = [...currentMonthEvents];

    for (const event of upcomingEvents) {
        if (!merged.some(existing => existing.id === event.id)) {
            merged.push(event);
        }
        if (merged.length >= count) {
            break;
        }
    }

    if (process.env.NODE_ENV === 'development') {
        console.log('[getFeaturedEventsFirestore] Final merged events:', merged.length);
        merged.forEach(e => {
            console.log(`  - ${e.title}: ${e.occurrences?.[0]?.date}`);
        });
    }

    return merged.slice(0, count);
}

/**
 * [SERVER-SIDE] Adds a new event document using the Admin SDK.
 */
export async function addEvent(eventData: Omit<Event, 'id'>): Promise<Event> {
    const docRef = await adminDb.collection('events').add(eventData);
    return { id: docRef.id, ...eventData };
}

/**
 * [SERVER-SIDE] Checks if an event already exists using the Admin SDK.
 */
export async function eventExists(title: string, venueId: string): Promise<boolean> {
    if (!venueId) return false;

    const q = adminDb.collection('events')
        .where('title', '==', title)
        .where('venueId', '==', venueId);

    const snapshot = await q.count().get();
    return snapshot.data().count > 0;
}


// --- News Article Functions ---
/**
 * [SERVER-SIDE] Adds a new news article document.
 */
export async function addNewsArticle(articleData: Omit<NewsArticle, 'id'>): Promise<NewsArticle> {
    const docRef = await adminDb.collection('news').add(articleData);
    const doc = await docRef.get();
    const data = doc.data();

    return {
        id: doc.id,
        ...data,
        createdAt: safeToISOString(data?.createdAt),
    } as NewsArticle;
}

/**
 * [SERVER-SIDE] Fetches all news articles using the Admin SDK, ordered by creation date.
 */
export async function getAllNewsArticles(): Promise<NewsArticle[]> {
    const snapshot = await adminDb.collection('news').get();

    const articles = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: safeToISOString(data.createdAt),
            order: data.order,
        } as NewsArticle;
    });

    // Custom sort: items with an 'order' value come first, sorted by that order.
    // Items without 'order' come next, sorted by their creation date.
    articles.sort((a, b) => {
        const aHasOrder = a.order !== undefined && a.order !== null;
        const bHasOrder = b.order !== undefined && b.order !== null;

        if (aHasOrder && bHasOrder) {
            return a.order - b.order;
        }
        if (aHasOrder) {
            return -1; // a comes first
        }
        if (bHasOrder) {
            return 1; // b comes first
        }
        // Neither has an order, so sort by creation date (newest first)
        return new Date(b.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return articles;
}


// --- Review Functions ---

/**
 * [SERVER-SIDE] Helper function to convert a Firestore review document into a clean, serializable Review object.
 */
function sanitizeReview(doc: admin.firestore.DocumentSnapshot): Review {
    const data = doc.data() || {};
    return {
        id: doc.id,
        showId: data.showId || '',
        showTitle: data.showTitle || 'Untitled Show',
        performanceDate: safeToISOString(data.performanceDate),
        reviewerId: data.reviewerId || '',
        reviewerName: data.reviewerName || 'Anonymous',
        createdAt: safeToISOString(data.createdAt),
        overallExperience: data.overallExperience || '',
        specialMomentsText: data.specialMomentsText || '',
        recommendations: data.recommendations || [],
        showHeartText: data.showHeartText || '',
        communityImpactText: data.communityImpactText || '',
        ticketInfo: data.ticketInfo || '',
        valueConsiderationText: data.valueConsiderationText || '',
        timeWellSpentText: data.timeWellSpentText || '',
        likes: data.likes || 0,
        dislikes: data.dislikes || 0,
        votedBy: data.votedBy || [],
        disclosureText: data.disclosureText || '',
    };
}


// Helper function to find a suitable event for the mock review
function findEventForMockReview(events: Event[]): Event | null {
    const today = startOfToday();

    // Priority 1: Find a completed, approved, non-audition event
    const pastEvent = events.find(e =>
        e.status === 'approved' &&
        e.type.toLowerCase() !== 'audition' &&
        e.occurrences?.length > 0 &&
        new Date(`${e.occurrences[e.occurrences.length - 1].date}T23:59:59`) < today
    );
    if (pastEvent) return pastEvent;

    // Priority 2 (Fallback): Find ANY approved, non-audition event
    const anySuitableEvent = events.find(e =>
        e.status === 'approved' &&
        e.type.toLowerCase() !== 'audition' &&
        e.occurrences?.length > 0
    );
    return anySuitableEvent || null;
}

// Helper function to create the mock review
function createMockReview(event: Event): Review {
    const performanceDate = event.occurrences?.[0]?.date || new Date().toISOString().split('T')[0];
    return {
        id: 'mock-review-1',
        showId: event.id,
        showTitle: event.title,
        performanceDate: safeToISOString(performanceDate),
        reviewerId: 'mock-user-id',
        reviewerName: 'Casey Critic',
        createdAt: new Date().toISOString(),
        overallExperience: "Exceptional & Memorable",
        specialMomentsText: "The lead's performance in the second act was breathtaking. A true masterclass in acting that left the entire audience speechless. The rock score was performed with incredible energy by the band, and the lighting design perfectly captured the show's dark, intense mood.",
        recommendations: ["Date Night", "Dramatic", "Musical"],
        showHeartText: "This was a profound exploration of a historical figure through a modern rock lens. It was challenging, but ultimately very rewarding.",
        communityImpactText: "A story like this is exactly what Eugene needs right now. It opens up important conversations and showcases incredible local talent.",
        ticketInfo: "Paid $35 for a seat in the mezzanine, Row E. The view was excellent for the price.",
        valueConsiderationText: "For the price of a movie ticket and popcorn, you get a live experience that will stick with you for weeks. The production value was outstanding and felt like a bargain.",
        timeWellSpentText: "Absolutely. The show was engaging from start to finish. I'd recommend it to anyone looking for a powerful night of theatre.",
        likes: 12,
        dislikes: 1,
        votedBy: [],
        disclosureText: "To be fully transparent, I am good friends with the lighting designer. I've done my best to remain objective in my review of the production as a whole.",
    };
}


/**
 * [SERVER-SIDE] Fetches all reviews using the Admin SDK, sorted by creation date.
 */
export async function getAllReviews(): Promise<Review[]> {
    const snapshot = await adminDb.collection('reviews').orderBy('createdAt', 'desc').get();
    const reviews = snapshot.docs.map(sanitizeReview);

    // If no real reviews exist, create a mock one for demonstration.
    if (reviews.length === 0) {
        // Find a past event to attach the mock review to
        const allEvents = await getAllEvents({ includeOccurrences: true });
        const eventForMock = findEventForMockReview(allEvents);
        if (eventForMock) {
            reviews.push(createMockReview(eventForMock));
        }
    }

    return reviews;
}


/**
 * [SERVER-SIDE] Fetches all reviews by a specific user.
 */
export async function getReviewsByUserId(userId: string): Promise<Review[]> {
    const snapshot = await adminDb.collection('reviews')
        .where('reviewerId', '==', userId)
        .get();

    const reviews = snapshot.docs.map(sanitizeReview);

    // Sort in-code to avoid needing a composite index in Firestore.
    // Use localeCompare for safe string comparison.
    reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return reviews;
}


// --- User Profile Functions ---

/**
 * [SERVER-SIDE] Gets all user profiles for admin management.
 */
export async function getAllUserProfiles(): Promise<UserProfile[]> {
    try {
        const snapshot = await adminDb.collection('userProfiles')
            .orderBy('displayName')
            .get();

        return snapshot.docs
            .filter(doc => {
                const data = doc.data();
                // Only include profiles with proper displayName
                const hasDisplayName = data.displayName && data.displayName.trim() !== '';
                const isTest = !!data.isTest || (typeof data.email === 'string' && data.email.toLowerCase().endsWith('@example.com'));
                return hasDisplayName && !isTest;
            })
            .map(doc => {
                const data = doc.data();
                return {
                    userId: doc.id,
                    displayName: data.displayName || '',
                    photoURL: data.photoURL || '',
                    email: data.email || '',
                    bio: data.bio,
                    roleInCommunity: data.roleInCommunity,
                    communityStartDate: data.communityStartDate,
                    galleryImageUrls: data.galleryImageUrls || [],
                    coverPhotoUrl: data.coverPhotoUrl,
                    showEmail: data.showEmail || false,
                    authStatus: data.authStatus || 'active',
                    isReviewer: !!data.isReviewer,
                    isVenueRep: !!data.isVenueRep,
                    assignedVenueIds: Array.isArray(data.assignedVenueIds) ? data.assignedVenueIds : [],
                    hasSeenVenueRepIntro: !!data.hasSeenVenueRepIntro,
                    venueRepOnboardingCompleted: !!data.venueRepOnboardingCompleted,
                    isTest: !!data.isTest,
                } as UserProfile;
            });
    } catch (error) {
        console.error('Error fetching all user profiles:', error);
        return [];
    }
}

/**
 * [SERVER-SIDE] Gets user profile statistics for admin dashboard.
 */
export async function getUserProfileStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    reviewers: number;
    admins: number;
}> {
    try {
        const [profilesSnapshot, reviewerRequestsSnapshot] = await Promise.all([
            adminDb.collection('userProfiles').get(),
            adminDb.collection('reviewerRequests').where('status', '==', 'approved').get()
        ]);

        // Filter out profiles that don't have proper displayName (these shouldn't be counted)
        const validProfiles = profilesSnapshot.docs.filter(doc => {
            const data = doc.data();
            const hasDisplayName = data.displayName && data.displayName.trim() !== '';
            const isTest = !!data.isTest || (typeof data.email === 'string' && data.email.toLowerCase().endsWith('@example.com'));
            return hasDisplayName && !isTest;
        });

        const totalUsers = validProfiles.length;
        const activeUsers = validProfiles.filter(doc => {
            const data = doc.data();
            return data.authStatus !== 'notFound';
        }).length;

        const reviewers = reviewerRequestsSnapshot.size;

        // Set admin count to 1 (just you for now)
        const admins = 1;

        return {
            totalUsers,
            activeUsers,
            reviewers,
            admins
        };
    } catch (error) {
        console.error('Error fetching user profile stats:', error);
        return {
            totalUsers: 0,
            activeUsers: 0,
            reviewers: 0,
            admins: 0
        };
    }
}

/**
 * [SERVER-SIDE] Fetches a user profile from Firestore, creating one if it doesn't exist.
 * This function now safely handles "ghost users" (profiles without a matching auth record)
 * and returns the user's authentication status.
 */
export async function getOrCreateUserProfile(userId: string): Promise<UserProfile | null> {
    try {
        const docRef = adminDb.collection('userProfiles').doc(userId);
        let userRecord: UserRecord | null = null;
        let authStatus: 'active' | 'notFound' = 'active';

        try {
            userRecord = await admin.auth().getUser(userId);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                console.warn(`GHOST USER DETECTED: Auth record for ID ${userId} not found.`);
                authStatus = 'notFound';
            } else {
                // For other auth errors, we should not proceed.
                // Let the master catch block handle logging and returning null.
                throw error;
            }
        }

        const docSnap = await docRef.get();

        // CASE 1: Profile document exists in Firestore.
        if (docSnap.exists) {
            const data = docSnap.data() || {};
            const coverPhotoUrl = typeof data.coverPhotoUrl === 'string' && data.coverPhotoUrl.includes('placehold.co/1600x400')
                ? ''
                : (data.coverPhotoUrl || '');

            const profile: UserProfile = {
                userId,
                displayName: data.displayName || userRecord?.displayName || 'New User',
                photoURL: data.photoURL || userRecord?.photoURL || 'https://placehold.co/200x200.png',
                email: data.email || userRecord?.email || '',
                bio: data.bio || 'Welcome to the Our Stage community! Feel free to edit your profile and share a bit about yourself.',
                roleInCommunity: data.roleInCommunity || 'Audience',
                communityStartDate: data.communityStartDate || '',
                galleryImageUrls: data.galleryImageUrls || [],
                coverPhotoUrl,
                showEmail: data.showEmail || false,
                authStatus: authStatus,
                isReviewer: !!data.isReviewer,
                isVenueRep: !!data.isVenueRep,
                assignedVenueIds: Array.isArray(data.assignedVenueIds) ? data.assignedVenueIds : [],
            };
            return profile;
        }

        // CASE 2: Profile document does NOT exist, but we have a valid Auth record. Create it.
        if (userRecord) {
            const newProfile: UserProfile = {
                userId: userRecord.uid,
                displayName: userRecord.displayName || 'New User',
                photoURL: userRecord.photoURL || 'https://placehold.co/200x200.png',
                email: userRecord.email || '',
                bio: 'Welcome to the Our Stage community! Feel free to edit your profile and share a bit about yourself.',
                roleInCommunity: 'Audience',
                communityStartDate: '',
                galleryImageUrls: [],
                coverPhotoUrl: '',
                showEmail: false,
                authStatus: 'active',
                isReviewer: false,
                isVenueRep: false,
                assignedVenueIds: [],
            };
            await docRef.set(newProfile);
            return newProfile;
        }

        // CASE 3: Profile and Auth record both do not exist (or ghost user without a profile doc).
        console.log(`User profile could not be found or created for ID: ${userId}.`);
        return null;
    } catch (err) {
        console.error(`A fatal error occurred in getOrCreateUserProfile for userId "${userId}":`, err);
        return null; // This guarantees the function never crashes the server.
    }
}


// --- Community Spotlight Functions ---

/**
 * [SERVER-SIDE] Gets the currently active community spotlight.
 */
export async function getActiveSpotlight(): Promise<CommunitySpotlight | null> {
    try {
        const snapshot = await adminDb.collection('communitySpotlights')
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            try {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name,
                    story: data.story,
                    photoUrl: data.photoUrl,
                    tags: data.tags,
                    createdAt: safeToISOString(data.createdAt),
                    createdBy: data.createdBy,
                    isActive: data.isActive,
                    links: data.links,
                    adminNotes: data.adminNotes,
                } as CommunitySpotlight;
            } catch (error) {
                console.error(`Error processing active spotlight document ${doc.id}:`, error);
                // If the active spotlight is corrupted, return null
                return null;
            }
        }

        return null;
    } catch (error) {
        console.error('Error fetching active spotlight:', error);
        return null;
    }
}

/**
 * [SERVER-SIDE] Gets all community spotlights (for admin management).
 */
export async function getAllSpotlights(): Promise<CommunitySpotlight[]> {
    try {
        const snapshot = await adminDb.collection('communitySpotlights')
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => {
            try {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || '',
                    story: data.story || '',
                    photoUrl: data.photoUrl || '',
                    tags: data.tags || [],
                    createdAt: safeToISOString(data.createdAt),
                    createdBy: data.createdBy || '',
                    isActive: data.isActive || false,
                    links: data.links || undefined,
                    adminNotes: data.adminNotes || undefined,
                } as CommunitySpotlight;
            } catch (error) {
                console.error(`Error processing spotlight document ${doc.id}:`, error);
                // Return a safe default for corrupted documents
                return {
                    id: doc.id,
                    name: 'Corrupted Spotlight',
                    story: 'This spotlight data is corrupted and needs to be recreated.',
                    photoUrl: '',
                    tags: [],
                    createdAt: new Date().toISOString(),
                    createdBy: 'system',
                    isActive: false,
                    links: undefined,
                    adminNotes: 'Corrupted data - please recreate this spotlight',
                } as CommunitySpotlight;
            }
        });
    } catch (error) {
        console.error('Error fetching all spotlights:', error);
        return [];
    }
}

/**
 * [SERVER-SIDE] Creates a new community spotlight.
 * Automatically deactivates any existing active spotlight.
 */
export async function createSpotlight(spotlightData: Omit<CommunitySpotlight, 'id'>): Promise<CommunitySpotlight | null> {
    try {
        // If this spotlight is being set as active, deactivate all others first
        if (spotlightData.isActive) {
            const activeSpotlights = await adminDb.collection('communitySpotlights')
                .where('isActive', '==', true)
                .get();

            const batch = adminDb.batch();
            activeSpotlights.docs.forEach(doc => {
                batch.update(doc.ref, { isActive: false });
            });
            await batch.commit();
        }

        // Create the new spotlight
        const docRef = await adminDb.collection('communitySpotlights').add({
            ...spotlightData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Return the created spotlight with current timestamp
        // Note: We use current time instead of reading back the serverTimestamp
        // to avoid the "invalid uint 32: NaN" error that occurs when serverTimestamp
        // hasn't been resolved yet
        return {
            id: docRef.id,
            name: spotlightData.name,
            story: spotlightData.story,
            photoUrl: spotlightData.photoUrl,
            tags: spotlightData.tags,
            createdAt: new Date().toISOString(),
            createdBy: spotlightData.createdBy,
            isActive: spotlightData.isActive,
            links: spotlightData.links,
            adminNotes: spotlightData.adminNotes,
        } as CommunitySpotlight;
    } catch (error) {
        console.error('Error creating spotlight:', error);
        return null;
    }
}

/**
 * [SERVER-SIDE] Updates an existing community spotlight.
 */
export async function updateSpotlight(id: string, updates: Partial<Omit<CommunitySpotlight, 'id' | 'createdAt'>>): Promise<boolean> {
    try {
        // If setting this spotlight as active, deactivate all others first
        if (updates.isActive === true) {
            const activeSpotlights = await adminDb.collection('communitySpotlights')
                .where('isActive', '==', true)
                .get();

            const batch = adminDb.batch();
            activeSpotlights.docs.forEach(doc => {
                if (doc.id !== id) { // Don't deactivate the one we're updating
                    batch.update(doc.ref, { isActive: false });
                }
            });
            await batch.commit();
        }

        // Update the spotlight
        await adminDb.collection('communitySpotlights').doc(id).update(updates);
        return true;
    } catch (error) {
        console.error('Error updating spotlight:', error);
        return false;
    }
}

/**
 * [SERVER-SIDE] Deletes a community spotlight.
 */
export async function deleteSpotlight(id: string): Promise<boolean> {
    try {
        await adminDb.collection('communitySpotlights').doc(id).delete();
        return true;
    } catch (error) {
        console.error('Error deleting spotlight:', error);
        return false;
    }
}


// --- Reviewer Request Functions ---

/**
 * [SERVER-SIDE] Gets all reviewer requests for admin management.
 */
export async function getAllReviewerRequests(): Promise<ReviewerRequest[]> {
    try {
        const snapshot = await adminDb.collection('reviewerRequests')
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                userId: data.userId || '',
                userName: data.userName || '',
                userEmail: data.userEmail || '',
                status: data.status || 'pending',
                createdAt: safeToISOString(data.createdAt),
            } as ReviewerRequest;
        });
    } catch (error) {
        console.error('Error fetching reviewer requests:', error);
        return [];
    }
}

/**
 * [SERVER-SIDE] Updates a reviewer request status.
 */
export async function updateReviewerRequestStatus(id: string, status: 'approved' | 'denied'): Promise<boolean> {
    try {
        await adminDb.collection('reviewerRequests').doc(id).update({ status });
        return true;
    } catch (error) {
        console.error('Error updating reviewer request status:', error);
        return false;
    }
}

/**
 * [SERVER-SIDE] Updates a reviewer request archived status.
 */
export async function updateReviewerRequestArchived(id: string, archived: boolean): Promise<boolean> {
    try {
        await adminDb.collection('reviewerRequests').doc(id).update({ archived });
        return true;
    } catch (error) {
        console.error('Error updating reviewer request archived status:', error);
        return false;
    }
}

// --- Analytics Functions ---

/**
 * [SERVER-SIDE] Gets comprehensive analytics data for admin dashboard.
 */
export async function getAnalyticsData(): Promise<{
    monthlyActiveUsers: number;
    totalPageViews: number;
    eventsThisMonth: number;
    reviewsWritten: number;
    userGrowth: { month: string; users: number }[];
    popularEvents: { title: string; views: number; id: string }[];
    reviewActivity: { month: string; reviews: number }[];
    eventsByStatus: { status: string; count: number }[];
}> {
    try {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);

        // Get all collections data
        const [usersSnapshot, eventsSnapshot, reviewsSnapshot] = await Promise.all([
            adminDb.collection('userProfiles').get(),
            adminDb.collection('events').get(),
            adminDb.collection('reviews').get()
        ]);

        // Calculate monthly active users (users with recent activity)
        const monthlyActiveUsers = usersSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.authStatus === 'active' && data.displayName && data.displayName.trim() !== '';
        }).length;

        // Calculate events this month
        const eventsThisMonth = eventsSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (!data.occurrences || !Array.isArray(data.occurrences)) return false;

            return data.occurrences.some((occurrence: any) => {
                if (!occurrence.date) return false;
                const eventDate = new Date(occurrence.date);
                return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
            });
        }).length;

        // Calculate total reviews written
        const reviewsWritten = reviewsSnapshot.size;

        // Calculate user growth over last 6 months
        const userGrowth = [];
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(currentYear, currentMonth - i, 1);
            const nextMonthDate = new Date(currentYear, currentMonth - i + 1, 1);

            const usersInMonth = usersSnapshot.docs.filter(doc => {
                const data = doc.data();
                if (!data.displayName || data.displayName.trim() === '') return false;

                // For now, we'll simulate growth since we don't have creation dates
                // In a real scenario, you'd filter by user creation date
                return true;
            }).length;

            userGrowth.push({
                month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                users: Math.max(1, Math.floor(usersInMonth * (0.7 + (i * 0.05)))) // Simulate growth
            });
        }

        // Get popular events (by number of reviews)
        const eventReviewCounts = new Map<string, { title: string; count: number }>();

        reviewsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const showId = data.showId;
            const showTitle = data.showTitle || 'Unknown Event';

            if (showId) {
                const current = eventReviewCounts.get(showId) || { title: showTitle, count: 0 };
                eventReviewCounts.set(showId, { title: showTitle, count: current.count + 1 });
            }
        });

        const popularEvents = Array.from(eventReviewCounts.entries())
            .map(([id, data]) => ({ id, title: data.title, views: data.count }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 5);

        // Calculate review activity over last 6 months
        const reviewActivity = [];
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(currentYear, currentMonth - i, 1);
            const nextMonthDate = new Date(currentYear, currentMonth - i + 1, 1);

            const reviewsInMonth = reviewsSnapshot.docs.filter(doc => {
                const data = doc.data();
                if (!data.createdAt) return false;

                const reviewDate = new Date(data.createdAt);
                return reviewDate >= monthDate && reviewDate < nextMonthDate;
            }).length;

            reviewActivity.push({
                month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
                reviews: reviewsInMonth
            });
        }

        // Calculate events by status
        const statusCounts = new Map<string, number>();
        eventsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'unknown';
            statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
        });

        const eventsByStatus = Array.from(statusCounts.entries())
            .map(([status, count]) => ({ status, count }));

        return {
            monthlyActiveUsers,
            totalPageViews: monthlyActiveUsers * 12, // Estimate based on user activity
            eventsThisMonth,
            reviewsWritten,
            userGrowth,
            popularEvents,
            reviewActivity,
            eventsByStatus
        };
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        return {
            monthlyActiveUsers: 0,
            totalPageViews: 0,
            eventsThisMonth: 0,
            reviewsWritten: 0,
            userGrowth: [],
            popularEvents: [],
            reviewActivity: [],
            eventsByStatus: []
        };
    }
}

/**
 * [SERVER-SIDE] Gets reviewer requests by status.
 */
export async function getReviewerRequestsByStatus(status: 'pending' | 'approved' | 'denied'): Promise<ReviewerRequest[]> {
    try {
        const snapshot = await adminDb.collection('reviewerRequests')
            .where('status', '==', status)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                userId: data.userId || '',
                userName: data.userName || '',
                userEmail: data.userEmail || '',
                status: data.status || 'pending',
                createdAt: safeToISOString(data.createdAt),
            } as ReviewerRequest;
        });
    } catch (error) {
        console.error('Error fetching reviewer requests by status:', error);
        return [];
    }
}

/**
 * [SERVER-SIDE] Gets all reviewers with their profile information and review statistics.
 */
export async function getAllReviewers(): Promise<(UserProfile & { reviewCount: number; lastReviewDate?: string; createdAt?: string })[]> {
    try {
        console.log('getAllReviewers: Starting query for isReviewer = true');
        // Get all user profiles with isReviewer = true
        const profilesSnapshot = await adminDb.collection('userProfiles')
            .where('isReviewer', '==', true)
            .get();

        console.log('getAllReviewers: Query completed, found', profilesSnapshot.docs.length, 'documents');

        const reviewers = profilesSnapshot.docs.map(doc => {
            const data = doc.data();
            console.log('getAllReviewers: Processing doc', doc.id, 'with isReviewer:', data.isReviewer);
            return {
                userId: doc.id,
                displayName: data.displayName || '',
                photoURL: data.photoURL || '',
                email: data.email || '',
                roleInCommunity: data.roleInCommunity,
                isReviewer: data.isReviewer,
                reviewCount: 0,
                lastReviewDate: undefined,
                createdAt: undefined, // Will be populated from Firebase Auth
                // Only include essential fields for admin UI - exclude heavy data
                bio: undefined,
                communityStartDate: undefined,
                galleryImageUrls: [],
                coverPhotoUrl: undefined,
                showEmail: undefined,
                authStatus: data.authStatus
            } as UserProfile & { reviewCount: number; lastReviewDate?: string; createdAt?: string };
        });

        // Get Firebase Auth account creation dates and review statistics for each reviewer
        for (const reviewer of reviewers) {
            try {
                // Fetch account creation date from Firebase Auth
                try {
                    const userRecord = await admin.auth().getUser(reviewer.userId);
                    reviewer.createdAt = userRecord.metadata.creationTime;
                    console.log(`getAllReviewers: Got creation time for ${reviewer.userId}: ${userRecord.metadata.creationTime}`);
                } catch (authError) {
                    console.error(`Error fetching auth data for reviewer ${reviewer.userId}:`, authError);
                    reviewer.createdAt = undefined;
                }

                // Fetch review statistics
                const reviewsSnapshot = await adminDb.collection('reviews')
                    .where('reviewerId', '==', reviewer.userId)
                    .get();

                reviewer.reviewCount = reviewsSnapshot.docs.length;

                if (reviewsSnapshot.docs.length > 0) {
                    // Sort reviews by createdAt in memory to avoid needing a composite index
                    const sortedReviews = reviewsSnapshot.docs.sort((a, b) => {
                        const dateA = a.data().createdAt;
                        const dateB = b.data().createdAt;
                        // Sort descending (newest first)
                        return dateB.localeCompare(dateA);
                    });

                    const lastReview = sortedReviews[0].data();
                    reviewer.lastReviewDate = safeToISOString(lastReview.createdAt);
                }
            } catch (reviewError) {
                console.error(`Error fetching data for reviewer ${reviewer.userId}:`, reviewError);
                // Continue with other reviewers even if one fails
                reviewer.reviewCount = 0;
                reviewer.lastReviewDate = undefined;
                reviewer.createdAt = undefined;
            }
        }

        // Sort reviewers by display name
        return reviewers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    } catch (error) {
        console.error('Error fetching reviewers:', error);
        return [];
    }
}

/**
 * [SERVER-SIDE] Gets detailed reviewer statistics for admin dashboard.
 */
export async function getReviewerStats(): Promise<{
    totalReviewers: number;
    activeReviewers: number; // Reviewers who have written at least one review
    pendingApplications: number;
    totalReviews: number;
    reviewsThisMonth: number;
}> {
    try {
        const [reviewersSnapshot, reviewsSnapshot, pendingRequestsSnapshot] = await Promise.all([
            adminDb.collection('userProfiles').where('isReviewer', '==', true).get(),
            adminDb.collection('reviews').get(),
            adminDb.collection('reviewerRequests').where('status', '==', 'pending').get()
        ]);

        const totalReviewers = reviewersSnapshot.docs.length;
        const totalReviews = reviewsSnapshot.docs.length;
        const pendingApplications = pendingRequestsSnapshot.docs.length;

        // Count active reviewers (those who have written at least one review)
        const reviewerIds = new Set(reviewsSnapshot.docs.map(doc => doc.data().reviewerId));
        const activeReviewers = reviewerIds.size;

        // Count reviews this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const reviewsThisMonth = reviewsSnapshot.docs.filter(doc => {
            const reviewDate = new Date(doc.data().createdAt);
            return reviewDate >= startOfMonth;
        }).length;

        return {
            totalReviewers,
            activeReviewers,
            pendingApplications,
            totalReviews,
            reviewsThisMonth
        };
    } catch (error) {
        console.error('Error fetching reviewer stats:', error);
        return {
            totalReviewers: 0,
            activeReviewers: 0,
            pendingApplications: 0,
            totalReviews: 0,
            reviewsThisMonth: 0
        };
    }
}

/**
 * [SERVER-SIDE] Gets reviews by a specific reviewer with show information.
 */
export async function getReviewsByReviewer(reviewerId: string): Promise<Review[]> {
    try {
        const snapshot = await adminDb.collection('reviews')
            .where('reviewerId', '==', reviewerId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(sanitizeReview);
    } catch (error) {
        console.error('Error fetching reviews by reviewer:', error);
        return [];
    }
}

'use server';

import { revalidatePath } from '@/lib/cache';
import { randomUUID } from 'crypto';
import { headers } from '@/lib/headers';

import { addEvent, eventExists, addNewsArticle, getOrCreateUserProfile, venueExists } from '@/lib/data';
import { adminDb, admin, getStorageBucket, getStorageBucketCandidates } from '@/lib/firebase-admin';
// Cloudinary removed: uploads and deletions are Firebase-only
import type { Event, EventOccurrence, NewsArticle, Review, Venue, UserProfile } from '@/lib/types';
import { scrapeEventDetails } from '@/ai/flows/scrape-event-details';
import type { ScrapeEventDetailsOutput } from '@/ai/flows/scrape-event-details';
import { scrapeArticle } from '@/ai/flows/scrape-article';
import { extractEventFromUrl } from '@/lib/html-extract';
import { postSlackMessage } from '@/lib/notifications';

// --- Test hook for Firestore adminDb (used only in unit tests) ---
let __testAdminDb: any | null = null;
export async function __setTestAdminDb(db: any | null) {
    __testAdminDb = db;
}
function getDb() {
    return __testAdminDb || adminDb;
}

// Lightweight auth debugging (masked) to help diagnose token issues
const __debugAuth = (process.env.DEBUG_AUTH === '1') || (process.env.NODE_ENV !== 'production');
function __authLog(...args: any[]) {
    if (__debugAuth) {
        try { console.log('[auth-debug]', ...args); } catch { }
    }
}
function __maskToken(t?: string | null) {
    if (!t) return 'none';
    try {
        const s = String(t);
        if (s.length <= 12) return `${s}`;
        return `${s.slice(0, 6)}...${s.slice(-6)}`;
    } catch {
        return 'unavailable';
    }
}

export async function revalidateAdminPaths() {
    revalidatePath('/admin');
    revalidatePath('/calendar');
    revalidatePath('/');
    revalidatePath('/news');
    revalidatePath('/reviews');
    revalidatePath('/about-us');
    revalidatePath('/timeline-demo');
}

/**
 * Update a review (author-only)
 * Only the original author (reviewerId) may edit their review. Admins should use flag/delete.
 */
export async function updateReviewAction(
    reviewId: string,
    updates: Partial<Pick<Review,
        'overallExperience' |
        'specialMomentsText' |
        'recommendations' |
        'showHeartText' |
        'communityImpactText' |
        'ticketInfo' |
        'valueConsiderationText' |
        'timeWellSpentText' |
        'disclosureText'
    >>,
    idToken?: string
) {
    try {
        // Get ID token either from arg or Authorization header using shared helper
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);

        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }

        // Enforce verified email
        if (decodedToken.email_verified !== true) {
            return { success: false, message: 'Please verify your email before editing your review.' };
        }

        const reviewRef = getDb().collection('reviews').doc(reviewId);
        const snap = await reviewRef.get();
        if (!snap.exists) {
            return { success: false, message: 'Review not found.' };
        }
        const current = snap.data() as Review;
        const requesterUid = decodedToken.uid;

        // Author-only edit
        if (current.reviewerId !== requesterUid) {
            return { success: false, message: 'Not authorized to edit this review.' };
        }

        // Whitelist fields to prevent changing immutable properties
        const allowedKeys: (keyof Review)[] = [
            'overallExperience',
            'specialMomentsText',
            'recommendations',
            'showHeartText',
            'communityImpactText',
            'ticketInfo',
            'valueConsiderationText',
            'timeWellSpentText',
            'disclosureText',
        ];

        const cleanUpdates: Partial<Review> = {};
        for (const key of allowedKeys) {
            const v = updates[key as keyof typeof updates];
            if (v !== undefined) (cleanUpdates as any)[key] = v;
        }

        // Nothing to update
        if (Object.keys(cleanUpdates).length === 0) {
            return { success: true, message: 'No changes to save.' };
        }

        // Set updatedAt; clear any active revision flags
        (cleanUpdates as any).updatedAt = new Date().toISOString();
        if (current.flaggedForRevision) {
            (cleanUpdates as any).flaggedForRevision = admin.firestore.FieldValue.delete();
            (cleanUpdates as any).flaggedReason = admin.firestore.FieldValue.delete();
            (cleanUpdates as any).flaggedAt = admin.firestore.FieldValue.delete();
            (cleanUpdates as any).flaggedBy = admin.firestore.FieldValue.delete();
        }

        await reviewRef.update(cleanUpdates);

        // Revalidate non-critical; swallow errors (e.g., in tests or offline)
        try {
            revalidatePath('/reviews');
            revalidatePath('/calendar');
            revalidatePath(`/profile/${requesterUid}`);
        } catch (e) {
            console.warn('[updateReviewAction] revalidate failed (ignored):', e);
        }

        return { success: true, message: 'Review updated successfully.' };
    } catch (error) {
        console.error('Failed to update review:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to update review: ${errorMessage}` };
    }
}

type ScrapeEventMeta = {
    processedBy: 'html' | 'ai';
    model?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    costUsd?: number;
};

function computeAiCostUsd(
    usage?: { inputTokens?: number; outputTokens?: number },
    model?: string
): number | undefined {
    if (!usage) return undefined;
    const input = usage.inputTokens ?? 0;
    const output = usage.outputTokens ?? 0;
    const perMTokens = (v?: string) => (v ? Number(v) : NaN);

    const m = (model || '').toLowerCase();
    const envM = (process.env.AI_MODEL || '').toLowerCase();
    let inRate = NaN;
    let outRate = NaN;

    // Normalize provider detection in case the returned model lacks a provider prefix
    const googleLike = m.startsWith('googleai/') || m.includes('gemini') || envM.startsWith('googleai/') || envM.includes('gemini');
    const openaiLike = m.startsWith('openai/') || m.includes('gpt') || envM.startsWith('openai/') || envM.includes('gpt');

    // Google Gemini pricing (supports tiering by 128k prompt/output threshold when *_LOW_*/*_HIGH_* vars are present)
    if (googleLike) {
        const isFlash = m.includes('flash') || envM.includes('flash');
        const isPro = m.includes('pro') || envM.includes('pro');
        const inputHighTier = (usage.inputTokens ?? 0) > 128_000; // prompts > 128k tokens
        const outputHighTier = (usage.outputTokens ?? 0) > 128_000; // generations > 128k tokens

        const pickTiered = (
            lowVar?: string,
            highVar?: string,
            singleVar?: string,
            isHigh?: boolean
        ) => {
            // Prefer explicit tiered vars, else single rate var
            const low = perMTokens(lowVar);
            const high = perMTokens(highVar);
            const single = perMTokens(singleVar);
            if (Number.isFinite(low) && Number.isFinite(high)) {
                return isHigh ? (high as number) : (low as number);
            }
            return single;
        };

        if (isFlash) {
            inRate = pickTiered(
                process.env.GEMINI_FLASH_INPUT_LOW_USD_PER_MTOKENS,
                process.env.GEMINI_FLASH_INPUT_HIGH_USD_PER_MTOKENS,
                process.env.GEMINI_FLASH_INPUT_USD_PER_MTOKENS,
                inputHighTier
            );
            outRate = pickTiered(
                process.env.GEMINI_FLASH_OUTPUT_LOW_USD_PER_MTOKENS,
                process.env.GEMINI_FLASH_OUTPUT_HIGH_USD_PER_MTOKENS,
                process.env.GEMINI_FLASH_OUTPUT_USD_PER_MTOKENS,
                outputHighTier
            );
        } else if (isPro) {
            inRate = pickTiered(
                process.env.GEMINI_PRO_INPUT_LOW_USD_PER_MTOKENS,
                process.env.GEMINI_PRO_INPUT_HIGH_USD_PER_MTOKENS,
                process.env.GEMINI_PRO_INPUT_USD_PER_MTOKENS,
                inputHighTier
            );
            outRate = pickTiered(
                process.env.GEMINI_PRO_OUTPUT_LOW_USD_PER_MTOKENS,
                process.env.GEMINI_PRO_OUTPUT_HIGH_USD_PER_MTOKENS,
                process.env.GEMINI_PRO_OUTPUT_USD_PER_MTOKENS,
                outputHighTier
            );
        }
        if (!Number.isFinite(inRate)) inRate = perMTokens(process.env.GENAI_INPUT_USD_PER_MTOKENS);
        if (!Number.isFinite(outRate)) outRate = perMTokens(process.env.GENAI_OUTPUT_USD_PER_MTOKENS);
    }

    // OpenAI pricing (GPT-4o family, GPT-5 family)
    if (openaiLike) {
        // GPT-4o
        if (m.includes('gpt-4o-mini')) {
            inRate = perMTokens(process.env.OPENAI_GPT4O_MINI_INPUT_USD_PER_MTOKENS);
            outRate = perMTokens(process.env.OPENAI_GPT4O_MINI_OUTPUT_USD_PER_MTOKENS);
        } else if (m.includes('gpt-4o')) { // plain 4o
            inRate = perMTokens(process.env.OPENAI_GPT4O_INPUT_USD_PER_MTOKENS);
            outRate = perMTokens(process.env.OPENAI_GPT4O_OUTPUT_USD_PER_MTOKENS);
        }

        // GPT-5 family
        if (m.includes('gpt-5-mini')) {
            inRate = perMTokens(process.env.OPENAI_GPT5_MINI_INPUT_USD_PER_MTOKENS);
            outRate = perMTokens(process.env.OPENAI_GPT5_MINI_OUTPUT_USD_PER_MTOKENS);
        } else if (m.includes('gpt-5-nano')) {
            inRate = perMTokens(process.env.OPENAI_GPT5_NANO_INPUT_USD_PER_MTOKENS);
            outRate = perMTokens(process.env.OPENAI_GPT5_NANO_OUTPUT_USD_PER_MTOKENS);
        } else if (m.includes('gpt-5')) {
            inRate = perMTokens(process.env.OPENAI_GPT5_INPUT_USD_PER_MTOKENS);
            outRate = perMTokens(process.env.OPENAI_GPT5_OUTPUT_USD_PER_MTOKENS);
        }

        // Generic OpenAI fallback if provided
        if (!Number.isFinite(inRate)) inRate = perMTokens(process.env.OPENAI_INPUT_USD_PER_MTOKENS);
        if (!Number.isFinite(outRate)) outRate = perMTokens(process.env.OPENAI_OUTPUT_USD_PER_MTOKENS);
    }

    if (Number.isFinite(inRate) && Number.isFinite(outRate)) {
        const cost = (input / 1_000_000) * (inRate as number) + (output / 1_000_000) * (outRate as number);
        return Math.round(cost * 1e6) / 1e6;
    }
    return undefined;
}

// --- Test hook for token decoding (used only in unit tests) ---
let __testTokenDecoder: null | ((token: string) => Promise<any>) = null;
export async function __setTestTokenDecoder(decoder: ((token: string) => Promise<any>) | null) {
    __testTokenDecoder = decoder;
}

// Helper to retrieve and verify the Firebase ID token either from an argument or the Authorization header
async function getDecodedTokenFromHeadersOrArg(idToken?: string): Promise<import('firebase-admin').auth.DecodedIdToken | null> {
    let token = idToken;
    let source: 'arg' | 'header' | 'none' = token ? 'arg' : 'none';
    try {
        if (!token) {
            const hdrs = await headers();
            const authHeader = hdrs.get('Authorization');
            const hasBearer = !!authHeader?.startsWith('Bearer ');
            __authLog('Token lookup: argPresent=%s headerHasBearer=%s', !!idToken, hasBearer);
            if (hasBearer) {
                token = authHeader!.split('Bearer ')[1];
                source = 'header';
            }
        } else {
            __authLog('Token provided via arg: %s', __maskToken(token));
        }
        if (token) {
            if (__testTokenDecoder) {
                const decoded = await __testTokenDecoder(token);
                __authLog('Decoded via test decoder from %s: uid=%s email=%s', source, decoded?.uid, decoded?.email);
                return decoded as any;
            }
            const decoded = await admin.auth().verifyIdToken(token);
            __authLog('verifyIdToken ok from %s: uid=%s email=%s', source, decoded?.uid, decoded?.email);
            return decoded;
        }
        __authLog('No token found from arg or headers');
    } catch (err: any) {
        __authLog('verifyIdToken failed. source=%s token=%s error=%s', source, __maskToken(token), err?.message || String(err));
    }
    return null;
}

export async function scrapeEventAction(url: string | undefined, screenshotDataUri: string, model?: string) {
    try {
        // Try HTML-first scraping when a URL is provided
        if (url) {
            try {
                const htmlData = await extractEventFromUrl(url);
                if (htmlData) {
                    const meta: ScrapeEventMeta = { processedBy: 'html' };
                    return { success: true, data: { ...htmlData, sourceUrl: url }, meta };
                }
            } catch (htmlErr) {
                console.warn('HTML extraction failed, falling back to AI:', htmlErr);
            }
        }

        // Fallback to AI-based extraction (uses screenshot and optional URL)
        const { output, meta } = await scrapeEventDetails({ url, screenshotDataUri }, model);
        const costUsd = computeAiCostUsd(meta?.usage, meta?.model);
        const combinedMeta: ScrapeEventMeta = {
            processedBy: 'ai',
            model: meta?.model,
            usage: meta?.usage,
            costUsd,
        };
        return { success: true, data: { ...output, sourceUrl: url }, meta: combinedMeta };
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
    posterUrl?: string;
    venueId: string;
    type: string;
    tags?: string[];
    occurrences: EventOccurrence[];
}

export async function addEventFromFormAction(data: EventFormData, idToken?: string) {
    try {
        // AuthN/AuthZ: allow admin or venue reps assigned to the target venue
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true; // testing fallback like AuthProvider
        let canManageVenue = isAdmin;
        if (!isAdmin) {
            const profile = await getOrCreateUserProfile(decodedToken.uid);
            const isRep = !!profile?.isVenueRep;
            const assigned = profile?.assignedVenueIds || [];
            canManageVenue = isRep && assigned.includes(data.venueId);
        }
        if (!canManageVenue) {
            return { success: false, message: 'Not authorized to add events for this venue.' };
        }

        const { title, venueId } = data;

        // Validate venue existence to prevent creating events for non-existent venues
        const venueIsReal = await venueExists(venueId);
        if (!venueIsReal) {
            return { success: false, message: 'Venue not found. Please select a valid venue.' };
        }
        const alreadyExists = await eventExists(title, venueId);
        if (alreadyExists) {
            return { success: false, message: `This event ("${title}") already exists in the system for this venue.` };
        }

        const newEvent: Omit<Event, 'id'> = {
            ...data,
            description: data.description || '',
            tags: data.tags || [],
            status: isAdmin ? 'approved' : 'pending',
            createdBy: decodedToken.uid,
        };

        await addEvent(newEvent);
        await revalidateAdminPaths();
        return {
            success: true,
            message: isAdmin
                ? 'Event added and approved successfully.'
                : 'Event submitted for approval. You will be notified once an admin approves it.'
        };

    } catch (error) {
        console.error('Failed to add event:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}


export async function updateEventAction(eventId: string, data: EventFormData, idToken?: string) {
    try {
        // AuthN/AuthZ: allow admin or venue reps assigned to the event's venue
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true; // testing fallback like AuthProvider

        const eventRef = adminDb.collection('events').doc(eventId);
        const existingSnap = await eventRef.get();
        if (!existingSnap.exists) {
            return { success: false, message: 'Event not found.' };
        }
        const current = existingSnap.data() as Event;

        // Authorization: Only admin or creator may edit.
        if (!isAdmin) {
            const requesterUid = decodedToken.uid;
            const isCreator = !!(current as any).createdBy && (current as any).createdBy === requesterUid;
            if (!isCreator) {
                // Legacy fallback: allow assigned venue reps to edit events that predate `createdBy`
                const profile = await getOrCreateUserProfile(requesterUid);
                const isRep = !!profile?.isVenueRep;
                const assigned = profile?.assignedVenueIds || [];
                const legacyAllowed = (!(current as any).createdBy || (current as any).createdBy === '') && isRep && assigned.includes(current.venueId);
                if (!legacyAllowed) {
                    return { success: false, message: 'Only the event creator or an admin can edit this event.' };
                }
            }
            // Venue reps cannot change the venue of an event
            if (data.venueId && data.venueId !== current.venueId) {
                return { success: false, message: 'Venue representatives cannot change the venue of an event.' };
            }
        }

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


        await eventRef.update(cleanData);

        await revalidateAdminPaths();
        return { success: true, message: 'Event updated successfully.' };
    } catch (error) {
        console.error('Failed to update event:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

// Upload an event poster image and return a public URL
export async function uploadEventPosterAction(formData: FormData, idToken?: string) {
    try {
        const file = formData.get('poster') as File | null;
        const venueId = (formData.get('venueId') as string | null) || '';

        if (!file || !venueId) {
            return { success: false, message: 'Missing file or venueId.' };
        }

        // AuthN/AuthZ: allow admin or venue reps assigned to the target venue
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true; // testing fallback like AuthProvider
        let canManageVenue = isAdmin;
        if (!isAdmin) {
            const profile = await getOrCreateUserProfile(decodedToken.uid);
            const isRep = !!profile?.isVenueRep;
            const assigned = profile?.assignedVenueIds || [];
            canManageVenue = isRep && assigned.includes(venueId);
        }
        if (!canManageVenue) {
            return { success: false, message: 'Not authorized to upload posters for this venue.' };
        }

        // Basic validation
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxBytes = 10 * 1024 * 1024; // 10MB
        if (!allowedTypes.includes(file.type)) {
            return { success: false, message: 'Unsupported file type. Please upload a JPG, PNG, GIF, or WEBP image.' };
        }
        if (typeof file.size === 'number' && file.size > maxBytes) {
            return { success: false, message: 'File too large. Maximum size is 10 MB.' };
        }

        // Cloudinary removed; using Firebase Storage only

        // Firebase Storage fallback (robust bucket resolution with production fallback)
        let bucket;
        try {
            bucket = getStorageBucket();
        } catch (error) {
            console.warn('getStorageBucket failed, using fallback bucket resolution:', error);
            // Fallback: try to get bucket directly from environment or use default
            const fallbackBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
            const admin = await import('firebase-admin');
            bucket = fallbackBucket ? admin.default.storage().bucket(fallbackBucket) : admin.default.storage().bucket();
        }
        const buffer = Buffer.from(await file.arrayBuffer());

        // Light integrity check
        const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSig);
        const isGif = buffer.length > 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
        const isRiff = buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF';
        const isWebp = isRiff && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        const looksLikeImage = isJpeg || isPng || isGif || isWebp;
        if (!looksLikeImage) {
            return { success: false, message: 'File content does not look like a valid image.' };
        }

        const fileName = `events/${venueId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${file.name}`;
        const fileUpload = bucket.file(fileName);
        const token = randomUUID();
        await fileUpload.save(buffer, {
            resumable: false,
            validation: 'crc32c',
            metadata: {
                contentType: file.type,
                cacheControl: 'public, max-age=31536000, immutable',
                metadata: { firebaseStorageDownloadTokens: token },
            },
        });
        const bucketName = fileUpload.bucket.name;
        const encodedPath = encodeURIComponent(fileUpload.name);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
        return { success: true, url: publicUrl };
    } catch (error) {
        console.error('Failed to upload event poster:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Upload failed: ${errorMessage}` };
    }
}

export async function updateEventStatusAction(eventId: string, status: 'approved' | 'denied', idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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

export async function deleteEventAction(eventId: string, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

        await adminDb.collection('events').doc(eventId).delete();
        await revalidateAdminPaths();
        return { success: true, message: 'Event deleted successfully.' };
    } catch (error) {
        console.error('Failed to delete event:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function updateVenueAction(venueId: string, data: Partial<Omit<Venue, 'id'>>, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            __authLog('updateVenueAction: no decoded token (arg=%s)', __maskToken(idToken));
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        __authLog('updateVenueAction requester uid=%s email=%s isAdmin=%s', decodedToken.uid, decodedToken.email, isAdmin);
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

        await adminDb.collection('venues').doc(venueId).update(data);
        await revalidateAdminPaths();
        return { success: true, message: 'Venue updated successfully.' };
    } catch (error) {
        console.error('Failed to update venue:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function createVenueAction(data: Omit<Venue, 'id'>, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

        await adminDb.collection('venues').add(data);
        await revalidateAdminPaths();
        return { success: true, message: 'Venue created successfully.' };
    } catch (error) {
        console.error('Failed to create venue:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function deleteVenueAction(venueId: string, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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

export async function saveNewsArticleAction(data: ArticleFormData, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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

export async function updateNewsArticleOrderAction(orderedArticleIds: string[], idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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

export async function addSpotlightNominationAction(data: {
    nomineeName: string;
    nomineeProfileId?: string;
    nomineeEmail?: string;
    reason?: string;
    submittedByUid?: string;
    submittedByName?: string;
    submittedByEmail?: string;
}) {
    try {
        const nomination = {
            ...data,
            status: 'new',
            createdAt: new Date().toISOString(),
        };

        await adminDb.collection('spotlightNominations').add(nomination);

        // Best-effort Slack notification (non-blocking)
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'our-stage-eugene-w930o';
        const consoleUrl = `https://console.firebase.google.com/project/${projectId}/firestore/data/~2FspotlightNominations`;
        await postSlackMessage(
            [
                ':star2: New Spotlight Nomination',
                `Nominee: ${data.nomineeName}`,
                data.nomineeEmail ? `Nominee Email: ${data.nomineeEmail}` : undefined,
                data.submittedByName || data.submittedByEmail
                    ? `Submitted by: ${data.submittedByName || 'Unknown'}${data.submittedByEmail ? ` <${data.submittedByEmail}>` : ''}`
                    : undefined,
                data.reason ? `Reason: ${data.reason}` : undefined,
                `Open in Console: ${consoleUrl}`,
            ].filter(Boolean).join('\n')
        );

        return { success: true, message: 'Nomination submitted successfully.' };
    } catch (error) {
        console.error('Failed to submit spotlight nomination:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}

export async function submitReviewAction(
    data: Omit<Review, 'id' | 'createdAt' | 'likes' | 'dislikes' | 'votedBy'>,
    idToken?: string
) {
    try {
        // Authenticate via token arg or Authorization header
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        if (decodedToken.email_verified !== true) {
            return { success: false, message: 'Please verify your email before submitting a review.' };
        }

        const requesterUid = decodedToken.uid;
        const reviewerNameFromToken = (decodedToken as any).name as string | undefined;

        const reviewData = {
            ...data,
            reviewerId: requesterUid, // derive from verified token
            reviewerName: reviewerNameFromToken || data.reviewerName || 'Anonymous Reviewer',
            likes: 0,
            dislikes: 0,
            votedBy: [],
            createdAt: new Date().toISOString(),
        } as Omit<Review, 'id'>;

        await getDb().collection('reviews').add(reviewData);

        // Revalidate non-critical; swallow errors (e.g., in tests or offline)
        try {
            revalidatePath('/calendar');
            revalidatePath('/reviews');
            revalidatePath(`/profile/${requesterUid}`);
        } catch (e) {
            console.warn('[submitReviewAction] revalidate failed (ignored):', e);
        }
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

export async function updateUserProfileAction(userId: string, data: Partial<UserProfile>, idToken?: string) {
    try {
        // Auth: owner or admin
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        const isOwner = decodedToken.uid === userId;
        if (!isOwner && !isAdmin) {
            return { success: false, message: 'Not authorized to update this profile.' };
        }

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

        // Cloudinary path removed; using Firebase Storage only

        // Firebase Storage upload path (legacy fallback) using robust bucket resolver with production fallback
        let bucket;
        try {
            bucket = getStorageBucket();
        } catch (error) {
            console.warn('getStorageBucket failed, using fallback bucket resolution:', error);
            // Fallback: try to get bucket directly from environment or use default
            const fallbackBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
            const admin = await import('firebase-admin');
            bucket = fallbackBucket ? admin.default.storage().bucket(fallbackBucket) : admin.default.storage().bucket();
        }
        const buffer = Buffer.from(await file.arrayBuffer());

        // Integrity checks: ensure buffer length matches file size
        if (typeof file.size === 'number' && buffer.length !== file.size) {
            throw new Error(`Buffer size mismatch for ${file.name}. Expected ${file.size}, got ${buffer.length}`);
        }

        // Magic-byte checks for a broad set of image types
        const typeStr = (file as any).type || '';
        const lowerName = (file.name || '').toLowerCase();
        const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSig);
        const isGif = buffer.length > 3 && buffer.subarray(0, 4).toString('ascii') === 'GIF8';
        const isRiff = buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF';
        const isWebp = isRiff && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
        const isBmp = buffer.length > 1 && buffer[0] === 0x42 && buffer[1] === 0x4d; // 'BM'
        const isTiff = (buffer.length > 3 && buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00)
            || (buffer.length > 3 && buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a);
        const isIsoBaseFtyp = buffer.length > 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
        const brand = isIsoBaseFtyp ? buffer.subarray(8, 12).toString('ascii') : '';
        const isHeicFamily = isIsoBaseFtyp && ['heic', 'heif', 'hevc', 'mif1', 'msf1'].includes(brand);
        const isAvif = isIsoBaseFtyp && (brand === 'avif' || brand === 'avis');
        const svgProbe = buffer.subarray(0, Math.min(buffer.length, 200)).toString('utf8').toLowerCase();
        const isSvg = (typeStr === 'image/svg+xml' || lowerName.endsWith('.svg')) && svgProbe.includes('<svg');
        const looksLikeImage = isJpeg || isPng || isGif || isWebp || isBmp || isTiff || isHeicFamily || isAvif || isSvg;
        if (!looksLikeImage) {
            // If the browser says it's an image, allow it but log a warning to reduce false negatives
            if (typeof typeStr === 'string' && typeStr.startsWith('image/')) {
                console.warn(`[uploadProfilePhotoAction] Unrecognized image signature for ${file.name} (mime=${typeStr}). Proceeding.`);
            } else {
                throw new Error(`File content for ${file.name} does not look like a valid image`);
            }
        }

        // Server-side normalization: convert HEIC/HEIF/AVIF to JPEG to ensure browser compatibility
        let outBuffer = buffer;
        let outContentType = (file as any).type || 'application/octet-stream';
        const isHeicMime = /image\/(heic|heif)/i.test(outContentType) || lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || isHeicFamily;
        const isAvifMime = /image\/avif/i.test(outContentType) || lowerName.endsWith('.avif') || isAvif;
        if (isHeicMime || isAvifMime) {
            try {
                const sharp = (await import('sharp')).default;
                outBuffer = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
                outContentType = 'image/jpeg';
                console.log('[uploadProfilePhotoAction] Converted via sharp to JPEG');
            } catch (convErr) {
                console.warn('[uploadProfilePhotoAction] sharp conversion failed, attempting heic-convert fallback:', convErr);
                try {
                    const heic = (await import('heic-convert')).default as any;
                    const converted = await heic({ buffer, format: 'JPEG', quality: 0.85 });
                    // heic-convert may return Buffer or ArrayBuffer
                    outBuffer = Buffer.isBuffer(converted) ? converted : Buffer.from(converted);
                    outContentType = 'image/jpeg';
                    console.log('[uploadProfilePhotoAction] Converted via heic-convert to JPEG');
                } catch (fallbackErr) {
                    console.warn('[uploadProfilePhotoAction] heic-convert fallback failed, storing original buffer (may not render in browsers):', fallbackErr);
                }
            }
        }

        const fileName = `${userId}/${Date.now()}-${(file.name || 'photo').replace(/\.(heic|heif|avif)$/i, '')}${outContentType === 'image/jpeg' ? '.jpg' : ''}`;
        const fileUpload = bucket.file(fileName);
        const token = randomUUID();
        await fileUpload.save(outBuffer, {
            resumable: false,
            validation: 'crc32c',
            metadata: {
                contentType: outContentType,
                cacheControl: 'public, max-age=31536000, immutable',
                metadata: { firebaseStorageDownloadTokens: token },
            },
        });
        const bucketName = fileUpload.bucket.name;
        const encodedPath = encodeURIComponent(fileUpload.name);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

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

        const uploadedUrls: string[] = [];
        const errors: string[] = [];

        // Process files in batches to avoid overwhelming the system
        const batchSize = 5;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);

            const batchPromises = batch.map(async (file: File, batchIndex: number) => {
                try {
                    const buffer = Buffer.from(await file.arrayBuffer());

                    // Integrity checks
                    if (typeof file.size === 'number' && buffer.length !== file.size) {
                        throw new Error(`Buffer size mismatch. Expected ${file.size}, got ${buffer.length}`);
                    }
                    const typeStr = (file as any).type || '';
                    const lowerName = (file.name || '').toLowerCase();
                    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
                    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
                    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSig);
                    const isGif = buffer.length > 3 && buffer.subarray(0, 4).toString('ascii') === 'GIF8';
                    const isRiff = buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF';
                    const isWebp = isRiff && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
                    const isBmp = buffer.length > 1 && buffer[0] === 0x42 && buffer[1] === 0x4d;
                    const isTiff = (buffer.length > 3 && buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00)
                        || (buffer.length > 3 && buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a);
                    const isIsoBaseFtyp = buffer.length > 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
                    const brand = isIsoBaseFtyp ? buffer.subarray(8, 12).toString('ascii') : '';
                    const isHeicFamily = isIsoBaseFtyp && ['heic', 'heif', 'hevc', 'mif1', 'msf1'].includes(brand);
                    const isAvif = isIsoBaseFtyp && (brand === 'avif' || brand === 'avis');
                    const svgProbe = buffer.subarray(0, Math.min(buffer.length, 200)).toString('utf8').toLowerCase();
                    const isSvg = (typeStr === 'image/svg+xml' || lowerName.endsWith('.svg')) && svgProbe.includes('<svg');
                    const looksLikeImage = isJpeg || isPng || isGif || isWebp || isBmp || isTiff || isHeicFamily || isAvif || isSvg;
                    if (!looksLikeImage) {
                        if (typeof typeStr === 'string' && typeStr.startsWith('image/')) {
                            console.warn(`[uploadMultiplePhotosAction] Unrecognized image signature for ${file.name} (mime=${typeStr}). Proceeding.`);
                        } else {
                            throw new Error('File content does not look like a valid image');
                        }
                    }

                    // Use Firebase Admin SDK for server-side uploads
                    const fileName = `users/${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;

                    // Get storage bucket with robust fallback
                    let bucket;
                    try {
                        bucket = getStorageBucket();
                    } catch (error) {
                        console.warn('getStorageBucket failed, using fallback bucket resolution:', error);
                        // Fallback: try to get bucket directly from environment or use default
                        const fallbackBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
                        const admin = await import('firebase-admin');
                        bucket = fallbackBucket ? admin.default.storage().bucket(fallbackBucket) : admin.default.storage().bucket();
                    }

                    // Server-side normalization: convert HEIC/HEIF/AVIF to JPEG
                    let outBuffer = buffer;
                    let outContentType = (file as any).type || 'application/octet-stream';
                    const isHeicMime = /image\/(heic|heif)/i.test(outContentType) || lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || isHeicFamily;
                    const isAvifMime = /image\/avif/i.test(outContentType) || lowerName.endsWith('.avif') || isAvif;
                    if (isHeicMime || isAvifMime) {
                        try {
                            const sharp = (await import('sharp')).default;
                            outBuffer = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
                            outContentType = 'image/jpeg';
                            console.log('[uploadMultiplePhotosAction] Converted via sharp to JPEG');
                        } catch (convErr) {
                            console.warn('[uploadMultiplePhotosAction] sharp conversion failed, attempting heic-convert fallback:', convErr);
                            try {
                                const heic = (await import('heic-convert')).default as any;
                                const converted = await heic({ buffer, format: 'JPEG', quality: 0.85 });
                                outBuffer = Buffer.isBuffer(converted) ? converted : Buffer.from(converted);
                                outContentType = 'image/jpeg';
                                console.log('[uploadMultiplePhotosAction] Converted via heic-convert to JPEG');
                            } catch (fallbackErr) {
                                console.warn('[uploadMultiplePhotosAction] heic-convert fallback failed, storing original buffer (may not render):', fallbackErr);
                            }
                        }
                    }

                    const finalName = `users/${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}-${(file.name || 'photo').replace(/\.(heic|heif|avif)$/i, '')}${outContentType === 'image/jpeg' ? '.jpg' : ''}`;
                    const fileUpload = bucket.file(finalName);
                    const token = randomUUID();

                    await fileUpload.save(outBuffer, {
                        resumable: false,
                        validation: 'crc32c',
                        metadata: {
                            contentType: outContentType,
                            cacheControl: 'public, max-age=31536000, immutable',
                            metadata: { firebaseStorageDownloadTokens: token },
                        },
                    });

                    const bucketName = fileUpload.bucket.name;
                    const encodedPath = encodeURIComponent(fileUpload.name);
                    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

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
                message: `Uploaded ${uploadedUrls.length} of ${files.length} photos. ${errors.length} failed: ${errors.join(', ')}`
            };
        } else {
            return { success: false, message: `All uploads failed: ${errors.join(', ')}` };
        }
    } catch (error) {
        console.error('Failed to upload photos:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Upload failed: ${errorMessage}` };
    }
}

export async function updateGalleryOrderAction(userId: string, orderedUrls: string[], idToken?: string) {
    try {
        // Auth: owner or admin
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        const isOwner = decodedToken.uid === userId;
        if (!isOwner && !isAdmin) {
            return { success: false, message: 'Not authorized to modify this gallery.' };
        }

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

export async function deleteProfilePhotoAction(userId: string, photoUrl: string, idToken?: string) {
    // Authenticate requester: must be the owner (uid === userId) or admin (email matches admin env)
    let decodedToken: import('firebase-admin').auth.DecodedIdToken | null = null;
    try {
        if (!idToken) {
            const hdrs = await headers();
            const authHeader = hdrs.get('Authorization');
            if (authHeader?.startsWith('Bearer ')) {
                idToken = authHeader.split('Bearer ')[1];
            }
        }
        if (idToken) {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        }
    } catch (authErr) {
        console.warn('deleteProfilePhotoAction: Failed to verify ID token.', authErr);
        decodedToken = null;
    }
    const requesterUid = decodedToken?.uid;
    const requesterEmail = decodedToken?.email || '';
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    const isOwner = !!requesterUid && requesterUid === userId;
    const isAdmin = !!adminEmail && requesterEmail === adminEmail;

    if (!isOwner && !isAdmin) {
        return { success: false, message: 'Not authorized to delete this photo.' };
    }
    // Cloudinary deletion path removed; we fall back to Firebase/URL parsing logic which also supports soft-delete

    try {
        let bucket;
        try {
            bucket = getStorageBucket();
        } catch (error) {
            console.warn('getStorageBucket failed, using fallback bucket resolution:', error);
            // Fallback: try to get bucket directly from environment or use default
            const fallbackBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
            const adminSdk = await import('firebase-admin');
            bucket = fallbackBucket ? adminSdk.default.storage().bucket(fallbackBucket) : adminSdk.default.storage().bucket();
        }

        // Extract the file path from the Google Cloud Storage public URL
        let filePath: string | null = null;
        let parseWarning: string | null = null;

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
                    parseWarning = 'Invalid URL format: insufficient path parts';
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
                        parseWarning = 'Invalid Firebase Storage URL format';
                    }
                } else {
                    // Format: https://<bucket>.firebasestorage.app/path/to/file
                    filePath = decodeURIComponent(url.pathname.slice(1)); // remove leading '/'
                    console.log('firebasestorage.app format detected');
                    console.log('Extracted file path:', filePath);
                }
            } else {
                parseWarning = `Unsupported storage hostname: ${url.hostname}`;
            }

            console.log('Security check - filePath:', filePath);
            console.log('Security check - expected prefix:', `${userId}/`);
            console.log('Security check - starts with user ID:', filePath ? filePath.startsWith(`${userId}/`) : false);

            // Security check to ensure we are only deleting from the target user's folder
            if (filePath && !filePath.startsWith(`${userId}/`)) {
                if (isAdmin) {
                    // Admin override: allow deletion outside the target user's folder
                    console.warn('Admin override: bypassing folder prefix check for deletion.', { filePath, targetUserId: userId });
                } else {
                    parseWarning = `Invalid file path for deletion. Path: ${filePath}, Expected to start with: ${userId}/`;
                    filePath = null;
                }
            }

            if (filePath) {
                console.log('Security check passed, file path:', filePath);
            }

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            parseWarning = `Failed to parse photo URL: ${msg}`;
            console.error('Failed to parse photo URL for deletion:', { photoUrl, userId, error: msg });
        }

        // Attempt storage deletion only if we have a valid path
        if (filePath) {
            const file = bucket.file(filePath);

            // Delete from Firebase Storage
            await file.delete().catch(error => {
                // It's okay if the file doesn't exist, maybe it was already deleted.
                // We'll log other errors but continue, so the DB record is still removed.
                if (error.code !== 404) {
                    console.warn(`Firebase Storage deletion warning: ${error.message}`);
                }
            });
        } else {
            console.warn('Skipping storage deletion due to URL/path issue:', parseWarning);
        }

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
        if (parseWarning) {
            return { success: true, message: 'Removed from profile. Storage object could not be deleted due to URL/path issue.' };
        }
        return { success: true, message: 'Photo deleted successfully.' };

    } catch (error) {
        console.error('Failed to delete photo:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `An unexpected error occurred. Error: ${errorMessage}` };
    }
}


export async function setProfilePhotoAction(userId: string, photoUrl: string, idToken?: string) {
    try {
        // Auth: owner or admin
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        const isOwner = decodedToken.uid === userId;
        if (!isOwner && !isAdmin) {
            return { success: false, message: 'Not authorized to update this profile photo.' };
        }

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

export async function setCoverPhotoAction(userId: string, photoUrl: string, idToken?: string) {
    try {
        // Auth: owner or admin
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        const isOwner = decodedToken.uid === userId;
        if (!isOwner && !isAdmin) {
            return { success: false, message: 'Not authorized to update this cover photo.' };
        }

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

export async function uploadSpotlightPhotoAction(formData: FormData, idToken?: string) {
    const file = formData.get('photo') as File;
    const type = formData.get('type') as string;

    if (!file || !type) {
        return { success: false, message: 'Missing file or type.' };
    }
    // Admin-only
    const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
    if (!decodedToken?.uid) {
        return { success: false, message: 'Not authenticated.' };
    }
    {
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }
    }

    try {
        let bucket;
        try {
            bucket = getStorageBucket();
        } catch (error) {
            console.warn('getStorageBucket failed, using fallback bucket resolution:', error);
            // Fallback: try to get bucket directly from environment or use default
            const fallbackBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
            const admin = await import('firebase-admin');
            bucket = fallbackBucket ? admin.default.storage().bucket(fallbackBucket) : admin.default.storage().bucket();
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `spotlights/${Date.now()}-${file.name}`;
        const fileUpload = bucket.file(fileName);
        const token = randomUUID();

        await fileUpload.save(buffer, {
            metadata: {
                contentType: file.type,
                cacheControl: 'public, max-age=31536000, immutable',
                metadata: { firebaseStorageDownloadTokens: token },
            },
        });

        const bucketName = fileUpload.bucket.name;
        const encodedPath = encodeURIComponent(fileUpload.name);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

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
}, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

        const { createSpotlight } = await import('@/lib/data');

        const newSpotlight = await createSpotlight({
            ...spotlightData,
            createdAt: new Date().toISOString(),
            createdBy: decodedToken.email || decodedToken.uid,
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
}, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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

export async function deleteSpotlightAction(id: string, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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
export async function toggleReviewerStatusAction(userId: string, isReviewer: boolean, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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
export async function deleteReviewAction(reviewId: string, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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
export async function flagReviewForRevisionAction(reviewId: string, reason: string, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

        await adminDb.collection('reviews').doc(reviewId).update({
            flaggedForRevision: true,
            flaggedReason: reason,
            flaggedAt: new Date().toISOString(),
            flaggedBy: decodedToken.email || decodedToken.uid
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
export async function clearReviewRevisionFlagAction(reviewId: string, idToken?: string) {
    try {
        // Admin-only
        const decodedToken = await getDecodedTokenFromHeadersOrArg(idToken);
        if (!decodedToken?.uid) {
            return { success: false, message: 'Not authenticated.' };
        }
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const isAdmin = adminEmail ? decodedToken.email === adminEmail : true;
        if (!isAdmin) {
            return { success: false, message: 'Not authorized.' };
        }

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



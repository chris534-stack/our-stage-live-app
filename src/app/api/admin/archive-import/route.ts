import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Event } from '@/lib/types';

/**
 * POST /api/admin/archive-import
 * 
 * Batch import verified archive records as Events.
 * 
 * Body:
 * {
 *   events: Array<{
 *     title: string,
 *     description: string,
 *     venueId: string,
 *     type: EventType,
 *     tags?: string[],
 *     playwright?: string,
 *     composer?: string,
 *     director?: string,
 *     originalProductionYear?: number,
 *     researchConfidence?: 'low' | 'medium' | 'high',
 *     occurrences?: EventOccurrence[] // Optional - for archive events, may be empty or single
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!Array.isArray(body.events) || body.events.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Missing or empty events array' },
                { status: 400 }
            );
        }

        const results: { id: string; title: string; success: boolean; error?: string }[] = [];
        const batch = adminDb.batch();

        for (const eventData of body.events) {
            try {
                // Validate required fields
                if (!eventData.title || !eventData.venueId) {
                    results.push({
                        id: '',
                        title: eventData.title ?? 'Unknown',
                        success: false,
                        error: 'Missing required fields: title and venueId',
                    });
                    continue;
                }

                // Create event document
                const docRef = adminDb.collection('events').doc();
                const now = new Date().toISOString();

                const newEvent: Omit<Event, 'id'> & { createdAt: string; updatedAt: string } = {
                    title: eventData.title,
                    description: eventData.description ?? '',
                    venueId: eventData.venueId,
                    type: eventData.type ?? 'Play',
                    tags: eventData.tags ?? [],
                    status: 'approved', // Archive imports are pre-approved
                    createdBy: 'archive-import', // System user for batch imports
                    occurrences: eventData.occurrences ?? [],
                    // Archive-specific fields
                    playwright: eventData.playwright,
                    composer: eventData.composer,
                    director: eventData.director,
                    isArchived: true,
                    originalProductionYear: eventData.originalProductionYear,
                    researchConfidence: eventData.researchConfidence,
                    // Timestamps
                    createdAt: now,
                    updatedAt: now,
                };

                // Remove undefined fields before writing
                const cleanedEvent = Object.fromEntries(
                    Object.entries(newEvent).filter(([_, v]) => v !== undefined)
                );

                batch.set(docRef, cleanedEvent);

                results.push({
                    id: docRef.id,
                    title: eventData.title,
                    success: true,
                });
            } catch (error: any) {
                results.push({
                    id: '',
                    title: eventData.title ?? 'Unknown',
                    success: false,
                    error: error?.message ?? 'Unknown error',
                });
            }
        }

        // Commit batch
        await batch.commit();

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            results,
            summary: {
                total: body.events.length,
                imported: successCount,
                failed: failureCount,
            },
        });
    } catch (error: any) {
        console.error('Archive import API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error?.message ?? 'An unexpected error occurred'
            },
            { status: 500 }
        );
    }
}

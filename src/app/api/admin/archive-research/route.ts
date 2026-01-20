import { NextRequest, NextResponse } from 'next/server';
import {
    researchArchiveShow,
    researchArchiveShowBatch,
    parseShowList,
    type ArchiveResearchInput,
    type ArchiveResearchBatchInput
} from '@/ai/flows/research-archive-show';
import { extractShowListFromScreenshot } from '@/ai/flows/extract-show-list';

/**
 * POST /api/admin/archive-research
 * 
 * Research a single show or batch of shows for archive backfill.
 * 
 * Single show body:
 * {
 *   title: string,
 *   venue?: string,
 *   year?: number,
 *   additionalContext?: string
 * }
 * 
 * Batch mode body:
 * {
 *   batch: true,
 *   shows: ArchiveResearchInput[],
 *   defaultVenueId?: string
 * }
 * 
 * Parse text mode body:
 * {
 *   parseText: true,
 *   rawText: string,
 *   defaultVenueId?: string
 * }
 * 
 * Parse screenshot mode body:
 * {
 *   parseScreenshot: true,
 *   screenshotDataUri: string,
 *   venue?: string
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Handle screenshot parsing mode (AI-powered extraction)
        if (body.parseScreenshot && body.screenshotDataUri) {
            const { output } = await extractShowListFromScreenshot({
                screenshotDataUri: body.screenshotDataUri,
                venue: body.venue,
            });
            return NextResponse.json({
                success: true,
                shows: output.shows,
                count: output.totalFound,
                confidence: output.confidence,
                notes: output.notes,
            });
        }

        // Handle text parsing mode
        if (body.parseText && body.rawText) {
            const parsedShows = await parseShowList(body.rawText);
            return NextResponse.json({
                success: true,
                shows: parsedShows,
                count: parsedShows.length,
            });
        }

        // Handle batch mode
        if (body.batch && Array.isArray(body.shows)) {
            const batchInput: ArchiveResearchBatchInput = {
                shows: body.shows,
                defaultVenueId: body.defaultVenueId,
            };

            const { output, totalMeta } = await researchArchiveShowBatch(batchInput);

            return NextResponse.json({
                success: true,
                data: output,
                meta: totalMeta,
            });
        }

        // Handle single show mode
        if (!body.title) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: title' },
                { status: 400 }
            );
        }

        const input: ArchiveResearchInput = {
            title: body.title,
            venue: body.venue,
            year: body.year,
            additionalContext: body.additionalContext,
        };

        const { output, meta } = await researchArchiveShow(input);

        return NextResponse.json({
            success: true,
            data: output,
            meta,
        });
    } catch (error: any) {
        console.error('Archive research API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error?.message ?? 'An unexpected error occurred'
            },
            { status: 500 }
        );
    }
}

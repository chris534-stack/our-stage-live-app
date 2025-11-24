import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to manually revalidate cached pages
 * 
 * Usage: POST /api/revalidate?secret=YOUR_SECRET&path=/
 * 
 * This is useful for immediately clearing the ISR cache after deployments
 * or when you need to force a page refresh without waiting for the revalidate timer.
 */
export async function POST(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret');
    const path = request.nextUrl.searchParams.get('path') || '/';

    // Protect this endpoint with a secret token
    if (secret !== process.env.REVALIDATE_SECRET) {
        return NextResponse.json(
            { message: 'Invalid or missing secret' },
            { status: 401 }
        );
    }

    try {
        // Revalidate the specified path
        revalidatePath(path);

        return NextResponse.json({
            revalidated: true,
            path,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error revalidating:', err);
        return NextResponse.json(
            { message: 'Error revalidating', error: String(err) },
            { status: 500 }
        );
    }
}

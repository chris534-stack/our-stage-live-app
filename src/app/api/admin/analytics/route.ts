import { NextResponse } from 'next/server';
import { getAnalyticsData } from '@/lib/data';

export async function GET() {
    try {
        const analytics = await getAnalyticsData();
        return NextResponse.json(analytics);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch analytics data' },
            { status: 500 }
        );
    }
}

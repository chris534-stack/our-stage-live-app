import { NextResponse } from 'next/server';
import { getUserProfileStats } from '@/lib/data';

export async function GET() {
    try {
        const stats = await getUserProfileStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user stats' },
            { status: 500 }
        );
    }
}

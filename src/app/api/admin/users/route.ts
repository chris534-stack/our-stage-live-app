import { NextResponse } from 'next/server';
import { getAllUserProfiles } from '@/lib/data';

export async function GET() {
    try {
        const users = await getAllUserProfiles();
        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}

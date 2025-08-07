import { NextResponse } from 'next/server';
import { debugReviewerQuery } from '@/debug/reviewer-debug';

export async function GET() {
    try {
        // Capture console output
        const originalLog = console.log;
        const logs: string[] = [];
        
        console.log = (...args) => {
            logs.push(args.join(' '));
            originalLog(...args);
        };
        
        await debugReviewerQuery();
        
        // Restore original console.log
        console.log = originalLog;
        
        return NextResponse.json({
            success: true,
            logs: logs
        });
    } catch (error) {
        console.error('Debug API error:', error);
        return NextResponse.json(
            { error: 'Debug script failed', details: error },
            { status: 500 }
        );
    }
}

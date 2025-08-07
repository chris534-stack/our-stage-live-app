import { NextResponse } from 'next/server';
import { testRevokeReviewer } from '@/debug/test-revoke';

export async function GET() {
    try {
        // Capture console output
        const originalLog = console.log;
        const logs: string[] = [];
        
        console.log = (...args) => {
            logs.push(args.join(' '));
            originalLog(...args);
        };
        
        await testRevokeReviewer();
        
        // Restore original console.log
        console.log = originalLog;
        
        return NextResponse.json({
            success: true,
            logs: logs
        });
    } catch (error) {
        console.error('Test revoke API error:', error);
        return NextResponse.json(
            { error: 'Test revoke script failed', details: error },
            { status: 500 }
        );
    }
}

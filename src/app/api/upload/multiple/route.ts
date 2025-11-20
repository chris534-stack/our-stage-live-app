import { NextRequest, NextResponse } from 'next/server';
import { uploadMultiplePhotosAction } from '@/lib/actions';

// Ensure this route runs on the Node.js runtime so firebase-admin works in production
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'us-central1';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Call the server action
    const result = await uploadMultiplePhotosAction(formData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Multi-photo upload API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}

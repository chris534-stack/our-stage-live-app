import { NextRequest, NextResponse } from 'next/server';
import { uploadMultiplePhotosAction } from '@/lib/actions';

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

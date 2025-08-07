import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing file path.' 
      }, { status: 400 });
    }

    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!storageBucket) {
      return NextResponse.json({ 
        success: false, 
        message: 'Server configuration error: Storage destination not found.' 
      }, { status: 500 });
    }

    const bucket = admin.storage().bucket(storageBucket);
    const file = bucket.file(filePath);

    // Check if file exists before trying to delete
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({
        success: true,
        message: 'File does not exist (already cleaned up)'
      });
    }

    // Delete the test file
    await file.delete();

    return NextResponse.json({
      success: true,
      message: 'Test file cleaned up successfully'
    });

  } catch (error) {
    console.error('Cleanup failed:', error);
    return NextResponse.json({
      success: false,
      message: `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
}

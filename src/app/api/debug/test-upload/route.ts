import { NextRequest, NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing file or user ID.' 
      }, { status: 400 });
    }

    // Check storage bucket configuration
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!storageBucket) {
      console.error('Server configuration error: FIREBASE_STORAGE_BUCKET is not set.');
      return NextResponse.json({ 
        success: false, 
        message: 'Server configuration error: Storage destination not found.' 
      }, { status: 500 });
    }

    const bucket = admin.storage().bucket(storageBucket);
    
    // Create detailed diagnostic information
    const diagnosticInfo = {
      originalFileName: file.name,
      originalSize: file.size,
      contentType: file.type,
      uploadTimestamp: Date.now()
    };

    try {
      // Convert file to buffer with detailed tracking
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Verify buffer integrity
      if (buffer.length !== file.size) {
        return NextResponse.json({
          success: false,
          message: 'Buffer size mismatch during conversion',
          diagnosticInfo: {
            ...diagnosticInfo,
            bufferSize: buffer.length,
            expectedSize: file.size,
            sizeMismatch: true
          }
        });
      }

      // Create unique filename for diagnostic test
      const fileName = `diagnostic-test/${userId}/${Date.now()}-${file.name}`;
      const fileUpload = bucket.file(fileName);

      // Upload with metadata
      await fileUpload.save(buffer, {
        metadata: {
          contentType: file.type,
          customMetadata: {
            originalName: file.name,
            originalSize: file.size.toString(),
            diagnosticTest: 'true',
            uploadTimestamp: Date.now().toString()
          }
        },
      });

      // Make the file public
      await fileUpload.makePublic();
      const publicUrl = fileUpload.publicUrl();

      // Get file metadata to verify upload
      const [metadata] = await fileUpload.getMetadata();
      const uploadedSize = parseInt(String(metadata.size || '0'));

      // Verify upload integrity
      const uploadIntegrity = {
        sizeMatch: uploadedSize === file.size,
        uploadedSize,
        originalSize: file.size,
        contentType: metadata.contentType,
        generation: metadata.generation
      };

      return NextResponse.json({
        success: true,
        message: 'Diagnostic upload completed successfully',
        fileUrl: publicUrl,
        filePath: fileName,
        diagnosticInfo: {
          ...diagnosticInfo,
          bufferSize: buffer.length,
          uploadIntegrity,
          metadata: {
            size: metadata.size,
            contentType: metadata.contentType,
            timeCreated: metadata.timeCreated,
            generation: metadata.generation
          }
        }
      });

    } catch (uploadError) {
      console.error('Upload error during diagnostic:', uploadError);
      return NextResponse.json({
        success: false,
        message: `Upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`,
        diagnosticInfo: {
          ...diagnosticInfo,
          uploadError: uploadError instanceof Error ? uploadError.message : String(uploadError)
        }
      });
    }

  } catch (error) {
    console.error('Diagnostic test upload failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Diagnostic test failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, admin, getStorageBucket } from '@/lib/firebase-admin';
import { randomUUID } from 'crypto';

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

    // Robust bucket resolution
    const bucket = getStorageBucket();
    
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

      // Upload with metadata and token
      const token = randomUUID();
      await fileUpload.save(buffer, {
        resumable: false,
        validation: 'crc32c',
        metadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: {
            firebaseStorageDownloadTokens: token,
            originalName: file.name,
            originalSize: file.size.toString(),
            diagnosticTest: 'true',
            uploadTimestamp: Date.now().toString()
          }
        },
      });

      const bucketName = fileUpload.bucket.name;
      const encodedPath = encodeURIComponent(fileUpload.name);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

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

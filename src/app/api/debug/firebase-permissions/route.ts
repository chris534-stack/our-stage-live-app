import { NextRequest, NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();
    
    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: 'Invalid URLs provided' }, { status: 400 });
    }

    const results = await Promise.all(
      urls.map(async (url: string) => {
        let filePath = ''; // Declare filePath at function scope
        
        try {
          // Extract file path from Firebase Storage URL
          
          if (url.includes('storage.googleapis.com')) {
            const urlParts = url.split('/');
            const bucketIndex = urlParts.findIndex(part => part.includes('.appspot.com'));
            if (bucketIndex !== -1) {
              filePath = decodeURIComponent(urlParts.slice(bucketIndex + 1).join('/'));
            }
          } else if (url.includes('firebasestorage.googleapis.com')) {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const oIndex = pathParts.findIndex(part => part === 'o');
            if (oIndex !== -1 && pathParts[oIndex + 1]) {
              filePath = decodeURIComponent(pathParts[oIndex + 1]);
            }
          }

          if (!filePath) {
            return {
              url,
              error: 'Could not extract file path from URL',
              filePath: null
            };
          }

          // Check if file exists and get metadata
          const bucket = admin.storage().bucket();
          const file = bucket.file(filePath);
          
          const [exists] = await file.exists();
          if (!exists) {
            return {
              url,
              error: 'File does not exist in Firebase Storage',
              filePath,
              exists: false
            };
          }

          const [metadata] = await file.getMetadata();
          const [isPublic] = await file.isPublic();

          return {
            url,
            filePath,
            exists: true,
            isPublic,
            metadata: {
              name: metadata.name,
              size: metadata.size,
              contentType: metadata.contentType,
              timeCreated: metadata.timeCreated,
              updated: metadata.updated,
              generation: metadata.generation,
              cacheControl: metadata.cacheControl
            }
          };
        } catch (error) {
          return {
            url,
            error: error instanceof Error ? error.message : String(error),
            filePath: filePath || null
          };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Firebase permissions check failed:', error);
    return NextResponse.json(
      { error: 'Failed to check Firebase permissions' },
      { status: 500 }
    );
  }
}

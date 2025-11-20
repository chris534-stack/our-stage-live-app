import { NextRequest, NextResponse } from 'next/server';
import { adminDb, admin, getStorageBucket } from '@/lib/firebase-admin';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

function extractFilePathFromUrl(url: string): { filePath: string | null; reason?: string } {
  try {
    const u = new URL(url);
    // Cloudinary and other external hosts are considered valid; keep as-is
    if (u.hostname === 'res.cloudinary.com') {
      return { filePath: null };
    }

    if (u.hostname === 'storage.googleapis.com') {
      // Format: https://storage.googleapis.com/<bucket-name>/<path>
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const filePath = decodeURIComponent(parts.slice(1).join('/'));
        return { filePath };
      }
      return { filePath: null, reason: 'invalid_storage_googleapis_parts' };
    }

    if (u.hostname.includes('firebasestorage.googleapis.com')) {
      // Format: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?alt=media&token=...
      const m = u.pathname.match(/\/o\/(.+)$/);
      if (m && m[1]) {
        const fp = decodeURIComponent(m[1]);
        return { filePath: fp };
      }
      return { filePath: null, reason: 'invalid_firebase_storage_api_path' };
    }

    if (u.hostname.endsWith('.firebasestorage.app')) {
      // Format: https://<bucket>.firebasestorage.app/<path>
      const fp = decodeURIComponent(u.pathname.replace(/^\//, ''));
      return { filePath: fp };
    }

    return { filePath: null, reason: `unsupported_host_${u.hostname}` };
  } catch (e) {
    return { filePath: null, reason: 'url_parse_error' };
  }
}

async function ensureTokenUrlForPath(filePath: string) {
  const bucket = getStorageBucket();
  const file = bucket.file(filePath);

  const [exists] = await file.exists();
  if (!exists) {
    return { exists: false as const };
  }
  const [metadata] = await file.getMetadata();
  let token: string | null = null;
  const md = (metadata.metadata || {}) as Record<string, string | undefined>;
  if (md.firebaseStorageDownloadTokens) {
    // Can be comma-separated if multiple tokens
    token = md.firebaseStorageDownloadTokens.split(',')[0]?.trim() || null;
  }
  if (!token) {
    token = randomUUID();
    await file.setMetadata({
      metadata: {
        ...(metadata.metadata || {}),
        firebaseStorageDownloadTokens: token,
      },
      cacheControl: metadata.cacheControl || 'public, max-age=31536000, immutable',
      contentType: metadata.contentType,
    });
  }
  const bucketName = file.bucket.name;
  const encoded = encodeURIComponent(file.name);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
  return { exists: true as const, url };
}

export async function POST(req: NextRequest) {
  try {
    // Dev-only bypass: allow running without auth when explicitly requested in non-production
    const isDevBypass = process.env.NODE_ENV !== 'production' && req.nextUrl.searchParams.get('dev') === '1';
    if (!isDevBypass) {
      // Admin auth via Authorization: Bearer <ID_TOKEN>
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ ok: false, message: 'Missing Authorization bearer token' }, { status: 401 });
      }
      const idToken = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
      if (!decoded?.email || !adminEmail || decoded.email !== adminEmail) {
        return NextResponse.json({ ok: false, message: 'Not authorized' }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const userId = body.userId as string;
    const dryRun = Boolean(body.dryRun);
    if (!userId) {
      return NextResponse.json({ ok: false, message: 'userId is required' }, { status: 400 });
    }

    const profileRef = adminDb.collection('userProfiles').doc(userId);
    const snap = await profileRef.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: true, message: 'Profile not found; nothing to repair' });
    }

    const data = snap.data() || {};
    const gallery: string[] = Array.isArray(data.galleryImageUrls) ? data.galleryImageUrls : [];
    const coverPhotoUrl: string = data.coverPhotoUrl || '';
    const photoURL: string = data.photoURL || '';

    const results: Array<{ original: string; action: 'kept' | 'rewritten' | 'removed'; reason?: string; newUrl?: string }> = [];
    const toKeep: string[] = [];

    for (const url of gallery) {
      // Cloudinary images are considered OK as-is
      if (url.includes('res.cloudinary.com')) {
        toKeep.push(url);
        results.push({ original: url, action: 'kept' });
        continue;
      }

      const { filePath, reason } = extractFilePathFromUrl(url);
      if (!filePath) {
        results.push({ original: url, action: 'removed', reason: reason || 'unrecognized_url' });
        continue;
      }

      const ensured = await ensureTokenUrlForPath(filePath);
      if (!ensured.exists) {
        results.push({ original: url, action: 'removed', reason: 'object_not_found' });
        continue;
      }

      const newUrl = ensured.url;
      if (newUrl !== url) {
        results.push({ original: url, action: 'rewritten', newUrl });
        toKeep.push(newUrl);
      } else {
        results.push({ original: url, action: 'kept' });
        toKeep.push(url);
      }
    }

    // Adjust cover and profile photos if they reference removed URLs
    let newCover = coverPhotoUrl;
    if (coverPhotoUrl && !toKeep.includes(coverPhotoUrl)) {
      // If it was removed or rewritten, prefer rewritten version in toKeep if same path was found
      const match = results.find(r => r.original === coverPhotoUrl && r.action === 'rewritten');
      newCover = match?.newUrl || '';
    }

    let newPhotoURL = photoURL;
    if (photoURL && !toKeep.includes(photoURL)) {
      // Try to fall back to Firebase Auth photoURL
      try {
        const userRec = await admin.auth().getUser(userId);
        newPhotoURL = userRec.photoURL || '';
      } catch {
        newPhotoURL = '';
      }
    }

    if (!dryRun) {
      await profileRef.set({
        galleryImageUrls: toKeep,
        coverPhotoUrl: newCover,
        photoURL: newPhotoURL,
      }, { merge: true });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      userId,
      summary: {
        originalCount: gallery.length,
        newCount: toKeep.length,
        removed: results.filter(r => r.action === 'removed').length,
        rewritten: results.filter(r => r.action === 'rewritten').length,
      },
      details: results,
    });
  } catch (err) {
    console.error('repair-gallery failed', err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

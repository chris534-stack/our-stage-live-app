/*
  Repair gallery URLs for a specific user profile.
  - Rewrites old/broken Firebase Storage URLs to token-based download URLs
  - Removes URLs whose storage objects no longer exist
  - Optionally fixes coverPhotoUrl and photoURL if they reference removed assets

  Usage:
    npx tsx src/scripts/repair-gallery.ts --user <USER_ID> --dry-run
    npx tsx src/scripts/repair-gallery.ts --user <USER_ID>
*/

import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'crypto';

// Initialize Admin SDK
if (!getApps().length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: `${projectId}.appspot.com`,
    });
  } else {
    // Fall back to ADC (useful in many local/dev environments)
    initializeApp({ projectId });
  }
}

const db = getFirestore();
const storage = getStorage();
const auth = getAuth();

function parseArgs() {
  const args = process.argv.slice(2);
  const out: any = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--user' || a === '-u') { out.userId = args[++i]; }
    else if (a === '--dry-run') { out.dryRun = true; }
  }
  return out;
}

function extractFilePathFromUrl(url: string): { filePath: string | null; reason?: string } {
  try {
    const u = new URL(url);
    if (u.hostname === 'res.cloudinary.com') return { filePath: null };
    if (u.hostname === 'storage.googleapis.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return { filePath: decodeURIComponent(parts.slice(1).join('/')) };
      return { filePath: null, reason: 'invalid_storage_googleapis_parts' };
    }
    if (u.hostname.includes('firebasestorage.googleapis.com')) {
      const m = u.pathname.match(/\/o\/(.+)$/);
      if (m && m[1]) return { filePath: decodeURIComponent(m[1]) };
      return { filePath: null, reason: 'invalid_firebase_storage_api_path' };
    }
    if (u.hostname.endsWith('.firebasestorage.app')) {
      return { filePath: decodeURIComponent(u.pathname.replace(/^\//, '')) };
    }
    return { filePath: null, reason: `unsupported_host_${u.hostname}` };
  } catch {
    return { filePath: null, reason: 'url_parse_error' };
  }
}

async function ensureTokenUrlForPath(filePath: string) {
  const bucket = storage.bucket();
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  if (!exists) return { exists: false as const };
  const [metadata] = await file.getMetadata();
  let token: string | null = null;
  const md = (metadata.metadata || {}) as Record<string, string | undefined>;
  if (md.firebaseStorageDownloadTokens) token = md.firebaseStorageDownloadTokens.split(',')[0]?.trim() || null;
  if (!token) {
    token = randomUUID();
    await file.setMetadata({
      metadata: { ...(metadata.metadata || {}), firebaseStorageDownloadTokens: token },
      cacheControl: metadata.cacheControl || 'public, max-age=31536000, immutable',
      contentType: metadata.contentType,
    });
  }
  const bucketName = file.bucket.name;
  const encoded = encodeURIComponent(file.name);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
  return { exists: true as const, url };
}

async function main() {
  const { userId, dryRun } = parseArgs();
  if (!userId) {
    console.error('Usage: --user <USER_ID> [--dry-run]');
    process.exit(1);
  }

  const ref = db.collection('userProfiles').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log('Profile not found; nothing to repair.');
    return;
  }

  const data = snap.data() || {};
  const gallery: string[] = Array.isArray(data.galleryImageUrls) ? data.galleryImageUrls : [];
  const coverPhotoUrl: string = data.coverPhotoUrl || '';
  const photoURL: string = data.photoURL || '';

  const results: Array<{ original: string; action: 'kept' | 'rewritten' | 'removed'; reason?: string; newUrl?: string }> = [];
  const toKeep: string[] = [];

  for (const url of gallery) {
    if (url.includes('res.cloudinary.com')) { toKeep.push(url); results.push({ original: url, action: 'kept' }); continue; }
    const { filePath, reason } = extractFilePathFromUrl(url);
    if (!filePath) { results.push({ original: url, action: 'removed', reason: reason || 'unrecognized_url' }); continue; }
    const ensured = await ensureTokenUrlForPath(filePath);
    if (!ensured.exists) { results.push({ original: url, action: 'removed', reason: 'object_not_found' }); continue; }
    const newUrl = ensured.url;
    if (newUrl !== url) { results.push({ original: url, action: 'rewritten', newUrl }); toKeep.push(newUrl); }
    else { results.push({ original: url, action: 'kept' }); toKeep.push(url); }
  }

  let newCover = coverPhotoUrl;
  if (coverPhotoUrl && !toKeep.includes(coverPhotoUrl)) {
    const match = results.find(r => r.original === coverPhotoUrl && r.action === 'rewritten');
    newCover = match?.newUrl || '';
  }

  let newPhotoURL = photoURL;
  if (photoURL && !toKeep.includes(photoURL)) {
    try { const userRec = await auth.getUser(userId); newPhotoURL = userRec.photoURL || ''; } catch { newPhotoURL = ''; }
  }

  if (!dryRun) {
    await ref.set({ galleryImageUrls: toKeep, coverPhotoUrl: newCover, photoURL: newPhotoURL }, { merge: true });
  }

  console.log(JSON.stringify({
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
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });

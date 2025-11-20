
import 'server-only';

import admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

function normalizeBucketName(bucket?: string | null): string | undefined {
  if (!bucket) return undefined;
  let name = bucket.trim();
  if (!name) return undefined;

  if (name.startsWith('gs://')) {
    name = name.slice(5);
  } else if (name.startsWith('https://')) {
    try {
      const url = new URL(name);
      const bucketFromPath = url.pathname.match(/\/b\/([^/]+)/);
      if (bucketFromPath?.[1]) {
        name = bucketFromPath[1];
      }
    } catch {
      // ignore malformed URLs
    }
  }

  return name || undefined;
}

function expandBucketCandidates(rawBucket?: string | null, projectHints: string[] = []): string[] {
  const candidates = new Set<string>();
  const add = (value?: string) => {
    if (value) {
      const trimmed = value.trim();
      if (trimmed) {
        candidates.add(trimmed);
      }
    }
  };

  const normalized = normalizeBucketName(rawBucket);
  add(normalized);

  if (normalized?.endsWith('.firebasestorage.app')) {
    add(normalized.replace(/\.firebasestorage\.app$/i, '.appspot.com'));
  } else if (normalized?.endsWith('.appspot.com')) {
    add(normalized.replace(/\.appspot\.com$/i, '.firebasestorage.app'));
  }

  projectHints.forEach((hint) => {
    const trimmed = hint?.trim();
    if (!trimmed) return;

    if (trimmed.includes('.')) {
      add(trimmed);
    } else {
      add(`${trimmed}.firebasestorage.app`);
      add(`${trimmed}.appspot.com`);
    }
  });

  // Always allow the Admin SDK to decide as a final fallback
  candidates.add('');

  return Array.from(candidates);
}

let cachedBucketCandidates: string[] | null = null;
let loggedBucketName = false;

function getBucketCandidates(): string[] {
  if (cachedBucketCandidates) return cachedBucketCandidates;

  const projectHints = [
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    process.env.FIREBASE_ADMIN_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.GCLOUD_PROJECT,
    process.env.GOOGLE_CLOUD_PROJECT,
  ].filter((value): value is string => Boolean(value));

  cachedBucketCandidates = expandBucketCandidates(undefined, projectHints);

  // Ensure explicit bucket env vars stay at the front if provided
  const explicitCandidates = expandBucketCandidates(
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  );
  if (explicitCandidates.length) {
    const merged = new Set<string>(explicitCandidates);
    cachedBucketCandidates.forEach((candidate) => merged.add(candidate));
    cachedBucketCandidates = Array.from(merged);
  }

  if (process.env.NODE_ENV !== 'production') {
    const printable = cachedBucketCandidates.filter(Boolean);
    console.log('[storage] bucket candidates:', printable.length ? printable.join(', ') : '(default)');
  }

  return cachedBucketCandidates;
}

if (!getApps().length) {
  const config: admin.AppOptions = {};
  const bucketCandidates = getBucketCandidates();
  const preferredBucket = bucketCandidates.find((name) => name);
  if (preferredBucket) {
    config.storageBucket = preferredBucket;
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (privateKey) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    if (!projectId || !clientEmail) {
      throw new Error('Missing credentials for manual setup. When FIREBASE_ADMIN_PRIVATE_KEY is set, you must also provide FIREBASE_ADMIN_PROJECT_ID and FIREBASE_ADMIN_CLIENT_EMAIL.');
    }

    config.credential = cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\n/g, '\n'),
    });
  }

  initializeApp(config);
}

export const adminDb = admin.firestore();
export { admin };

export function getStorageBucket(index = 0) {
  const candidates = getBucketCandidates();
  const name = candidates[index] || undefined;
  const bucket = name ? admin.storage().bucket(name) : admin.storage().bucket();

  if (!loggedBucketName && process.env.NODE_ENV !== 'production') {
    loggedBucketName = true;
    console.log('[storage] using bucket handle:', bucket.name);
  }

  return bucket;
}

export function getStorageBucketCandidates(): string[] {
  return getBucketCandidates();
}




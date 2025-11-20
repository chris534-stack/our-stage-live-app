#!/usr/bin/env node

/**
 * Cleanup Test Users Script
 *
 * Safely identify and optionally clean up test user profiles in Firestore.
 * - DRY-RUN by default: shows what would be changed
 * - Requires --confirm to actually write changes
 * - Default action is to mark profiles with { isTest: true }
 * - Optional --delete will delete matching userProfiles after JSON backup
 *
 * Matching criteria (OR):
 *  - userProfiles.isTest === true
 *  - userProfiles.email ends with @example.com (configurable via --email-domain)
 *  - Optional regex on displayName via --name-pattern
 *
 * Usage examples:
 *   node scripts/cleanup-test-users.js                 # Dry-run, mark-only
 *   node scripts/cleanup-test-users.js --confirm       # Apply mark-only
 *   node scripts/cleanup-test-users.js --delete --confirm   # Backup then delete
 *   node scripts/cleanup-test-users.js --email-domain example.com --name-pattern "-test-" --confirm
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

// ---------- CLI ARG PARSING ----------
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const getArgVal = (flag, def) => {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return def;
};

const DO_CONFIRM = has('--confirm');
const DO_DELETE = has('--delete');
const EMAIL_DOMAIN = getArgVal('--email-domain', 'example.com');
const NAME_PATTERN = getArgVal('--name-pattern', '');
const COLLECTION = 'userProfiles';

// ---------- SAFETY BANNERS ----------
function banner(msg) {
  console.log('\n' + '='.repeat(70));
  console.log(msg);
  console.log('='.repeat(70) + '\n');
}

banner('Test User Cleanup - DRY RUN by default');
console.log(`Action: ${DO_DELETE ? 'DELETE (with backup)' : 'MARK isTest=true'}`);
console.log(`Dry-run: ${DO_CONFIRM ? 'NO (will modify data)' : 'YES (no writes)'}\n`);
console.log(`Criteria: isTest==true OR email ends with @${EMAIL_DOMAIN}${NAME_PATTERN ? ' OR displayName~/' + NAME_PATTERN + '/' : ''}`);

if (!admin.apps.length) {
  const saPath = path.join(__dirname, '..', 'firebase-service-account.json');
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  try {
    if (gac && fs.existsSync(gac)) {
      // Use Application Default Credentials via env var
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      console.log('Initialized Firebase Admin with GOOGLE_APPLICATION_CREDENTIALS (applicationDefault).');
    } else if (fs.existsSync(saPath)) {
      // Use local service account file at project root
      const serviceAccount = require(saPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('Initialized Firebase Admin with firebase-service-account.json.');
    } else {
      // Attempt application default as a fallback (e.g., on CI or GCP envs)
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      console.log('Initialized Firebase Admin with applicationDefault().');
    }
  } catch (e) {
    console.error('Failed to initialize Firebase Admin credentials. Provide firebase-service-account.json or set GOOGLE_APPLICATION_CREDENTIALS.', e.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function queryCandidates() {
  // Strategy: pull by isTest==true and by email domain separately, merge unique IDs
  const ids = new Set();
  const docs = new Map();

  const byIsTest = await db.collection(COLLECTION).where('isTest', '==', true).get();
  for (const d of byIsTest.docs) { ids.add(d.id); docs.set(d.id, d); }

  // Fallback: email domain scan (Firestore cannot query by suffix -> use client filter)
  const allProfiles = await db.collection(COLLECTION).select('email', 'displayName', 'isTest').get();
  for (const d of allProfiles.docs) {
    const data = d.data() || {};
    const email = String(data.email || '').toLowerCase();
    const disp = String(data.displayName || '');
    const nameMatch = NAME_PATTERN ? new RegExp(NAME_PATTERN, 'i').test(disp) : false;
    if (email.endsWith(`@${EMAIL_DOMAIN}`) || nameMatch) {
      ids.add(d.id);
      if (!docs.has(d.id)) docs.set(d.id, d);
    }
  }

  return Array.from(ids).map((id) => docs.get(id));
}

function backupFilepath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(4).toString('hex');
  const dir = path.join(__dirname, '..', 'tmp-backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `userProfiles-test-backup-${stamp}-${rand}.json`);
}

async function backupDocs(docs) {
  const out = docs.map((d) => ({ id: d.id, ...d.data() }));
  const file = backupFilepath();
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Backup written: ${file} (${out.length} docs)`);
  return file;
}

async function run() {
  try {
    const candidates = await queryCandidates();
    console.log(`Found ${candidates.length} test candidate profile(s).`);

    if (candidates.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    // Print summary
    console.log('\nCandidates:');
    for (const d of candidates) {
      const data = d.data() || {};
      console.log(` - ${d.id} | ${data.email || ''} | displayName="${data.displayName || ''}" | isTest=${!!data.isTest}`);
    }

    if (!DO_CONFIRM) {
      banner('DRY RUN COMPLETE - No changes were made. Re-run with --confirm to apply.');
      return;
    }

    // Backup before destructive operations
    let backupPath = '';
    if (DO_DELETE) {
      backupPath = await backupDocs(candidates);
    }

    // Apply mutations using batch (chunked)
    const CHUNK = 400; // Firestore limit safety
    for (let i = 0; i < candidates.length; i += CHUNK) {
      const slice = candidates.slice(i, i + CHUNK);
      const batch = db.batch();
      for (const d of slice) {
        if (DO_DELETE) {
          batch.delete(d.ref);
        } else {
          batch.update(d.ref, { isTest: true, updatedAt: new Date().toISOString() });
        }
      }
      await batch.commit();
      console.log(`Processed ${Math.min(i + CHUNK, candidates.length)} / ${candidates.length}`);
    }

    banner(`Cleanup complete. ${DO_DELETE ? 'Deleted' : 'Marked'} ${candidates.length} profile(s).${DO_DELETE ? ` Backup: ${backupPath}` : ''}`);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };

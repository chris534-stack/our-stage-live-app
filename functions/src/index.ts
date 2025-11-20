/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Initialize Firebase Admin SDK (idempotent)
try {
  admin.app();
} catch {
  admin.initializeApp();
}

const db = admin.firestore();

// ---- Utility helpers ----
function withCors(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res: any, status: number, body: any) {
  withCors(res);
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(body));
}

function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

const HOMOPHONES: Record<string, string> = {
  "to": "two",
  "too": "two",
  "there": "their",
  "they\'re": "their",
  "your": "you\'re",
  "you\'re": "you\'re",
};

function normalizeHomophones(words: string[]): string[] {
  return words.map((w) => HOMOPHONES[w] || w);
}

// ---- HTTP Functions ----

// 1) OCR ingest + parse (stubbed minimal parsing)
export const ingest_ocr = onRequest(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const { ownerId, scriptId, rawText, name } = req.body || {};
    if (!ownerId || !rawText) return sendJson(res, 400, { error: "ownerId and rawText are required" });

    const sid = scriptId || db.collection("scripts").doc().id;
    const now = new Date().toISOString();
    // Naive parse: split into lines with CHARACTER: dialogue pattern
    const lines = String(rawText).split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
    const sceneLines: any[] = [];
    for (const l of lines) {
      const m = l.match(/^([A-Z][A-Z\s\-']{1,40}):\s*(.+)$/);
      if (m) {
        const speaker = m[1].trim();
        const text = m[2].trim();
        sceneLines.push({ id: `${sceneLines.length + 1}`, speaker, text });
      }
    }
    const characters = Array.from(new Set(sceneLines.map((x) => x.speaker)));

    await db.collection("scripts").doc(sid).set({
      id: sid,
      ownerId,
      name: name || "Script",
      storagePath: "",
      fileType: "unknown",
      createdAt: now,
      updatedAt: now,
      characters,
      sceneIds: [],
      parseStatus: "parsed",
    });

    const scid = db.collection("scenes").doc().id;
    await db.collection("scenes").doc(scid).set({
      id: scid,
      ownerId,
      scriptId: sid,
      name: "Scene 1",
      order: 1,
      characters,
      lines: sceneLines,
      createdAt: now,
    });

    await db.collection("scripts").doc(sid).update({ sceneIds: [scid] });

    return sendJson(res, 200, { success: true, scriptId: sid, sceneId: scid, characters });
  } catch (e: any) {
    return sendJson(res, 500, { error: e?.message || String(e) });
  }
});

// 2) TTS line synthesis with caching (stub)
export const tts_line = onRequest(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const { text, voice, ownerId, sceneId, lineId } = req.body || {};
    if (!text || !ownerId || !sceneId || !lineId) return sendJson(res, 400, { error: "text, ownerId, sceneId, lineId required" });
    // Basic entitlement check: subscription must be active
    const planRef = db.doc(`users/${ownerId}/plan/line-notes`);
    const planSnap = await planRef.get();
    const active = !!planSnap.exists && !!(planSnap.data() as any)?.subscription?.active;
    if (!active) return sendJson(res, 403, { error: "Entitlement required" });
    // Stub: return a deterministic storage path where audio would be cached
    const path = `rehearsals/${ownerId}/tts/${sceneId}-${lineId}.mp3`;
    return sendJson(res, 200, { success: true, cached: false, storagePath: path, url: null, vendor: "stub" });
  } catch (e: any) {
    return sendJson(res, 500, { error: e?.message || String(e) });
  }
});

// 3) STT batch proxy (stub)
export const stt_batch = onRequest(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const { audioPaths } = req.body || {};
    const transcript = [{ ts: 0, text: "(stub transcript)" }];
    return sendJson(res, 200, { success: true, transcript, vendor: "stub" });
  } catch (e: any) {
    return sendJson(res, 500, { error: e?.message || String(e) });
  }
});

// 4) Alignment scoring (implemented)
export const align_notes = onRequest(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const { expected, transcript, role } = req.body || {} as { expected: Array<{ id: string; speaker: string; text: string }>; transcript: Array<{ ts: number; text: string }>; role: string };
    if (!Array.isArray(expected) || !Array.isArray(transcript)) return sendJson(res, 400, { error: "expected[] and transcript[] required" });

    // Build concatenated user transcript text
    const userText = normalizeText(transcript.map((t) => t.text).join(" "));
    const userWords = normalizeHomophones(userText.split(" ").filter(Boolean));

    const notes = expected.map((line) => {
      const target = normalizeText(line.text);
      const targetWords = normalizeHomophones(target.split(" ").filter(Boolean));
      const dist = levenshtein(targetWords.join(" "), userWords.join(" "));
      const maxLen = Math.max(targetWords.join(" ").length, 1);
      const score = Math.max(0, 1 - dist / maxLen);

      // Missed words heuristic: words in target not present in userWords set
      const userSet = new Set(userWords);
      const missed = targetWords.filter((w) => !userSet.has(w));

      // Pace estimation: use total transcript duration if available
      const totalDur = transcript.length > 1 ? (transcript[transcript.length - 1].ts - transcript[0].ts) : 0;
      const paceWpm = totalDur > 0 ? Math.round((userWords.length / totalDur) * 60) : undefined;

      return {
        lineId: line.id,
        score,
        missed,
        paraphrased: [],
        pickupDelayMs: undefined,
        paceWpm,
        feedback: score > 0.9 ? "Great recall." : score > 0.7 ? "Good, a few misses." : "Review this line.",
      };
    });

    return sendJson(res, 200, { success: true, notes });
  } catch (e: any) {
    return sendJson(res, 500, { error: e?.message || String(e) });
  }
});

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", { structuredData: true });
//   response.send("Hello from Firebase!");
// });

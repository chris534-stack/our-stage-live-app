'use server';

import { adminDb } from '@/lib/firebase-admin';

type NotifyOptions = { type?: string; meta?: Record<string, any> };

// Persist admin notifications so nothing gets lost if Slack is misconfigured or down
export async function logAdminNotification(text: string, opts?: NotifyOptions) {
  try {
    await adminDb.collection('adminNotifications').add({
      text,
      type: opts?.type || 'info',
      meta: opts?.meta || {},
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    try { console.warn('[notifications] Failed to persist admin notification:', e); } catch {}
  }
}

// Slack webhook notifier for admin alerts with Firestore fallback
// Configure SLACK_WEBHOOK_URL as a runtime secret in apphosting.yaml
export async function postSlackMessage(text: string, opts?: NotifyOptions): Promise<{ ok: boolean }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    try { console.warn('[notifications] SLACK_WEBHOOK_URL not set; logging to Firestore instead'); } catch {}
    await logAdminNotification(text, opts);
    return { ok: false };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      try { console.warn(`[notifications] Slack webhook non-OK: ${res.status} ${body}`); } catch {}
      await logAdminNotification(text, opts);
      return { ok: false };
    }

    return { ok: true };
  } catch (e) {
    try { console.warn('[notifications] Slack webhook failed:', e); } catch {}
    await logAdminNotification(text, opts);
    return { ok: false };
  }
}

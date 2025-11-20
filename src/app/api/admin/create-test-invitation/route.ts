import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const docRef = await adminDb.collection('reviewerInvitations').add({
      email: String(email).toLowerCase(),
      token,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt,
      archived: false,
    });

    return NextResponse.json({ success: true, token, invitationId: docRef.id });
  } catch (error) {
    console.error('Failed to create test invitation:', error);
    return NextResponse.json({ success: false, error: 'Failed to create invitation' }, { status: 500 });
  }
}

/**
 * Unit tests for submitReviewAction authentication, email verification, and behavior
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Use the local cache wrapper with injectable test revalidator

// Mock the firebase-admin wrapper used by actions.ts
jest.mock('@/lib/firebase-admin', () => {
  const verifyIdToken = jest.fn();
  const FieldValue = { delete: jest.fn(() => '__DELETE__') };
  const authObj = { verifyIdToken };
  const admin = {
    auth: jest.fn(() => authObj),
    firestore: { FieldValue },
  } as any;

  const adminDb = {
    collection: jest.fn(),
  } as any;

  return { admin, adminDb };
});

// Import after mocks are set up
import { submitReviewAction, __setTestTokenDecoder, __setTestAdminDb } from '../lib/actions';
import { setTestHeaders } from '../lib/headers';
import { setTestRevalidator } from '../lib/cache';

// Access mocks for configuration/assertions
const { adminDb, admin } = require('@/lib/firebase-admin');

let revalMock: jest.Mock;

function createBaseData(): any {
  return {
    showId: 'show-1',
    showTitle: 'Test Show',
    performanceDate: '2024-01-01',
    reviewerId: 'client-supplied-id', // should be ignored by server
    reviewerName: 'Client Name',
    overallExperience: 'Exceptional & Memorable',
    specialMomentsText: 'Great moments',
    recommendations: [],
    showHeartText: 'Heart of show',
    communityImpactText: 'Impact',
    ticketInfo: '$20, Row A',
    valueConsiderationText: 'Good value',
    timeWellSpentText: 'Yes',
    disclosureText: '',
  };
}

function setupReviewsAddMock() {
  const add = jest.fn();
  const mockCollection = { add };
  adminDb.collection.mockReturnValue(mockCollection);
  return add;
}

describe('submitReviewAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no Authorization header
    setTestHeaders(() => ({ get: (_: string) => null }));
    __setTestTokenDecoder(null);
    __setTestAdminDb(adminDb);
    revalMock = jest.fn();
    setTestRevalidator(revalMock);
  });

  afterEach(() => {
    setTestHeaders(null);
    __setTestTokenDecoder(null);
    __setTestAdminDb(null);
    setTestRevalidator(null);
  });

  it('returns Not authenticated when no token is provided', async () => {
    const add = setupReviewsAddMock();

    const result = await submitReviewAction(createBaseData());

    expect(result.success).toBe(false);
    expect(result.message).toBe('Not authenticated.');
    expect(add).not.toHaveBeenCalled();
  });

  it('rejects when email is not verified', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-1', email_verified: false });
    __setTestTokenDecoder(decode);

    // Provide token via Authorization header
    setTestHeaders(() => ({ get: (name: string) => (name === 'Authorization' ? 'Bearer token-unverified' : null) }));

    const add = setupReviewsAddMock();
    const result = await submitReviewAction(createBaseData());

    expect(result.success).toBe(false);
    expect(result.message).toBe('Please verify your email before submitting a review.');
    expect(decode).toHaveBeenCalledWith('token-unverified');
    expect(add).not.toHaveBeenCalled();
  });

  it('accepts token via argument, derives reviewerId/name from verified token, and revalidates paths', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-abc', email_verified: true, name: 'Token Name' });
    __setTestTokenDecoder(decode);

    const add = setupReviewsAddMock();
    const base = createBaseData();
    const result = await submitReviewAction(base, 'arg-token-1');

    expect(decode).toHaveBeenCalledWith('arg-token-1');

    expect(result.success).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    const payload: any = (add as jest.Mock).mock.calls[0][0];
    expect(payload.reviewerId).toBe('user-abc');
    expect(payload.reviewerName).toBe('Token Name');
    expect(typeof payload.createdAt).toBe('string');
    expect(payload.likes).toBe(0);
    expect(payload.dislikes).toBe(0);
    expect(Array.isArray(payload.votedBy)).toBe(true);

    expect(revalMock).toHaveBeenCalledWith('/calendar');
    expect(revalMock).toHaveBeenCalledWith('/reviews');
    expect(revalMock).toHaveBeenCalledWith('/profile/user-abc');
  });

  it('uses header Authorization token when no arg is provided and falls back to client-supplied reviewerName when token has no name', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-head', email_verified: true });
    __setTestTokenDecoder(decode);

    setTestHeaders(() => ({ get: (name: string) => (name === 'Authorization' ? 'Bearer token-header' : null) }));

    const add = setupReviewsAddMock();
    const base = createBaseData();
    const result = await submitReviewAction(base);

    expect(decode).toHaveBeenCalledWith('token-header');

    expect(result.success).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    const payload: any = (add as jest.Mock).mock.calls[0][0];
    expect(payload.reviewerId).toBe('user-head');
    expect(payload.reviewerName).toBe('Client Name');
  });
});

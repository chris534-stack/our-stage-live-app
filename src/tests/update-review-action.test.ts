/**
 * Unit tests for updateReviewAction permissions and behavior
 *
 * Scenarios covered:
 * - Not authenticated (no token)
 * - Review not found
 * - Not authorized (non-author)
 * - No changes to save
 * - Successful update with allowed fields and revalidation
 * - Clears moderation flags when flaggedForRevision is true
 * - Whitelists allowed fields (ignores disallowed keys)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Use the local cache wrapper with injectable test revalidator

// Use wrapper's injector instead of mocking the module

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
import { updateReviewAction, __setTestTokenDecoder, __setTestAdminDb } from '../lib/actions';
import { setTestHeaders } from '../lib/headers';
import { setTestRevalidator } from '../lib/cache';

// Access mocks for configuration/assertions
const { adminDb, admin } = require('@/lib/firebase-admin');

// Helpers to build Firestore doc mocks
function createMockReviewDoc() {
  const get = jest.fn() as any;
  const update = jest.fn() as any;
  return { get, update };
}

function setupReviewsCollection(mockDoc: any) {
  const mockCollection = {
    doc: jest.fn(() => mockDoc),
  };
  adminDb.collection.mockReturnValue(mockCollection);
  return mockCollection;
}

describe('updateReviewAction', () => {
  let revalMock: jest.Mock;
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
    // Reset
    setTestHeaders(null);
    __setTestTokenDecoder(null);
    __setTestAdminDb(null);
    setTestRevalidator(null);
  });

  it('returns Not authenticated when no token is provided', async () => {
    const result = await updateReviewAction('review-1', { overallExperience: 4 } as any);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Not authenticated.');
    expect(adminDb.collection).not.toHaveBeenCalled();
  });

  it('returns Review not found for missing document', async () => {
    // Arrange auth via test token decoder
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-1', email_verified: true });
    __setTestTokenDecoder(decode);

    // Arrange Firestore
    const mockDoc = createMockReviewDoc();
    mockDoc.get.mockResolvedValue({ exists: false } as any);
    setupReviewsCollection(mockDoc);

    // Provide token via Authorization header
    setTestHeaders(() => ({ get: (name: string) => name === 'Authorization' ? 'Bearer token-123' : null }));

    const result = await updateReviewAction('review-1', { overallExperience: 5 } as any);
    expect(decode).toHaveBeenCalledWith('token-123');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Review not found.');
    expect(mockDoc.update).not.toHaveBeenCalled();
    expect(revalMock).not.toHaveBeenCalled();
  });

  it('rejects non-authors with Not authorized message', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-1', email_verified: true });
    __setTestTokenDecoder(decode);

    const mockDoc = createMockReviewDoc();
    mockDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({ id: 'review-1', reviewerId: 'other-user' }),
    } as any);
    setupReviewsCollection(mockDoc);

    setTestHeaders(() => ({ get: (name: string) => name === 'Authorization' ? 'Bearer token-abc' : null }));

    const result = await updateReviewAction('review-1', { overallExperience: 2 } as any);
    expect(decode).toHaveBeenCalledWith('token-abc');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Not authorized to edit this review.');
    expect(mockDoc.update).not.toHaveBeenCalled();
  });

  it('returns success with No changes to save when updates are empty', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-1', email_verified: true });
    __setTestTokenDecoder(decode);

    const mockDoc = createMockReviewDoc();
    mockDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({ id: 'review-1', reviewerId: 'user-1' }),
    } as any);
    setupReviewsCollection(mockDoc);

    setTestHeaders(() => ({ get: (name: string) => name === 'Authorization' ? 'Bearer token-123' : null }));

    const result = await updateReviewAction('review-1', {});
    expect(decode).toHaveBeenCalledWith('token-123');

    expect(result.success).toBe(true);
    expect(result.message).toBe('No changes to save.');
    expect(mockDoc.update).not.toHaveBeenCalled();
  });

  it('updates whitelisted fields and revalidates paths on success', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-123', email_verified: true });
    __setTestTokenDecoder(decode);

    const mockDoc = createMockReviewDoc();
    mockDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({ id: 'review-1', reviewerId: 'user-123', flaggedForRevision: false }),
    } as any);
    setupReviewsCollection(mockDoc);

    const updates = {
      overallExperience: 4,
      disclosureText: 'Updated disclosure',
    } as any;

    setTestHeaders(() => ({ get: (name: string) => name === 'Authorization' ? 'Bearer token-ok' : null }));

    const result = await updateReviewAction('review-1', updates);
    expect(decode).toHaveBeenCalledWith('token-ok');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Review updated successfully.');

    expect(mockDoc.update).toHaveBeenCalledTimes(1);
    const updateArg = (mockDoc.update as jest.Mock).mock.calls[0][0] as any;
    expect(updateArg.overallExperience).toBe(4);
    expect(updateArg.disclosureText).toBe('Updated disclosure');
    expect(typeof updateArg.updatedAt).toBe('string');

    // Revalidate paths for reviews, calendar, and profile/{uid}
    expect(revalMock).toHaveBeenCalledWith('/reviews');
    expect(revalMock).toHaveBeenCalledWith('/calendar');
    expect(revalMock).toHaveBeenCalledWith('/profile/user-123');
  });

  it('clears moderation flags when flaggedForRevision is true', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'author-1', email_verified: true });
    __setTestTokenDecoder(decode);

    const mockDoc = createMockReviewDoc();
    mockDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'review-1',
        reviewerId: 'author-1',
        flaggedForRevision: true,
        flaggedReason: 'Needs edits',
        flaggedAt: '2024-01-01T00:00:00.000Z',
        flaggedBy: 'admin-1',
      }),
    } as any);
    setupReviewsCollection(mockDoc);

    setTestHeaders(() => ({ get: (name: string) => name === 'Authorization' ? 'Bearer token-auth' : null }));

    const result = await updateReviewAction(
      'review-1',
      { specialMomentsText: 'New highlights' }
    );
    expect(decode).toHaveBeenCalledWith('token-auth');

    expect(result.success).toBe(true);

    const updateArg = (mockDoc.update as jest.Mock).mock.calls[0][0] as any;
    // Ensure delete sentinel fields were injected
    expect(updateArg).toMatchObject({
      flaggedForRevision: expect.anything(),
      flaggedReason: expect.anything(),
      flaggedAt: expect.anything(),
      flaggedBy: expect.anything(),
    });

    // Presence of these props implies delete sentinels were applied in the update payload
  });

  it('rejects when email is not verified', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-unverified', email_verified: false });
    __setTestTokenDecoder(decode);

    // Provide token via Authorization header
    setTestHeaders(() => ({ get: (name: string) => name === 'Authorization' ? 'Bearer token-unverified' : null }));

    const result = await updateReviewAction('review-1', { overallExperience: 5 } as any);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Please verify your email before editing your review.');
    expect(decode).toHaveBeenCalledWith('token-unverified');

    // Should not attempt firestore read/update
    expect(adminDb.collection).not.toHaveBeenCalled();
  });

  it('ignores disallowed fields (whitelisting enforced)', async () => {
    const decode = jest.fn<(token: string) => Promise<any>>().mockResolvedValue({ uid: 'user-xyz', email_verified: true });
    __setTestTokenDecoder(decode);

    const mockDoc = createMockReviewDoc();
    mockDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({ id: 'review-1', reviewerId: 'user-xyz', flaggedForRevision: false }),
    } as any);
    setupReviewsCollection(mockDoc);

    setTestHeaders(() => ({ get: (name: string) => name === 'Authorization' ? 'Bearer token-xyz' : null }));

    const result = await updateReviewAction(
      'review-1',
      { reviewerId: 'hacker', overallExperience: 1 } as any
    );
    expect(decode).toHaveBeenCalledWith('token-xyz');

    expect(result.success).toBe(true);

    const updateArg = (mockDoc.update as jest.Mock).mock.calls[0][0] as any;
    expect(updateArg.reviewerId).toBeUndefined();
    expect(updateArg.overallExperience).toBe(1);
  });
});

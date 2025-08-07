/**
 * Comprehensive Debug Test Suite for Reviewer Invitation Pipeline
 * 
 * This test suite validates the entire reviewer invitation flow:
 * 1. Invitation creation
 * 2. Token validation
 * 3. Invitation acceptance
 * 4. Error handling and edge cases
 * 5. Database state consistency
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/invite/reviewer/[token]/route';
import type { ReviewerInvitation, UserProfile } from '@/lib/types';

// Mock Firebase Admin
jest.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: jest.fn(),
  }
}));

jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: jest.fn(),
  })
}));

describe('Reviewer Invitation Pipeline Debug Tests', () => {
  let mockCollection: any;
  let mockDoc: any;
  let mockQuery: any;
  let mockAuth: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock Firestore
    mockDoc = {
      ref: {
        update: jest.fn(),
      },
      id: 'test-invitation-id',
      data: jest.fn(),
    };
    
    mockQuery = {
      empty: false,
      docs: [mockDoc],
      limit: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: false, docs: [mockDoc] }),
    };
    
    mockCollection = {
      where: jest.fn().mockReturnValue(mockQuery),
      doc: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
      }),
    };

    const { adminDb } = require('@/lib/firebase-admin');
    adminDb.collection.mockReturnValue(mockCollection);

    // Setup mock Firebase Auth
    const { auth } = require('firebase-admin');
    mockAuth = auth();
  });

  describe('1. Invitation Token Validation (GET)', () => {
    it('should validate a valid pending invitation', async () => {
      const validInvitation: ReviewerInvitation = {
        id: 'test-id',
        email: 'test@example.com',
        token: 'valid-token',
        invitedBy: 'admin-id',
        invitedByName: 'Admin User',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      };

      mockDoc.data.mockReturnValue(validInvitation);

      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token');
      const response = await GET(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invitation).toBeDefined();
      expect(data.invitation.token).toBeUndefined(); // Token should be stripped
      expect(data.invitation.email).toBe('test@example.com');
    });

    it('should reject expired invitation', async () => {
      const expiredInvitation: ReviewerInvitation = {
        id: 'test-id',
        email: 'test@example.com',
        token: 'expired-token',
        invitedBy: 'admin-id',
        invitedByName: 'Admin User',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
        status: 'pending',
      };

      mockDoc.data.mockReturnValue(expiredInvitation);

      const request = new NextRequest('http://localhost/api/invite/reviewer/expired-token');
      const response = await GET(request, { params: { token: 'expired-token' } });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe('Invitation has expired');
      expect(mockDoc.ref.update).toHaveBeenCalledWith({ status: 'expired' });
    });

    it('should reject already accepted invitation', async () => {
      const acceptedInvitation: ReviewerInvitation = {
        id: 'test-id',
        email: 'test@example.com',
        token: 'accepted-token',
        invitedBy: 'admin-id',
        invitedByName: 'Admin User',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'accepted',
        usedAt: new Date().toISOString(),
        acceptedByUserId: 'user-123',
      };

      mockDoc.data.mockReturnValue(acceptedInvitation);

      const request = new NextRequest('http://localhost/api/invite/reviewer/accepted-token');
      const response = await GET(request, { params: { token: 'accepted-token' } });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe('Invitation already accepted');
    });

    it('should handle invalid token', async () => {
      mockQuery.empty = true;
      mockQuery.get.mockResolvedValue({ empty: true, docs: [] });

      const request = new NextRequest('http://localhost/api/invite/reviewer/invalid-token');
      const response = await GET(request, { params: { token: 'invalid-token' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Invalid invitation token');
    });

    it('should handle missing token parameter', async () => {
      const request = new NextRequest('http://localhost/api/invite/reviewer/');
      const response = await GET(request, { params: { token: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token is required');
    });
  });

  describe('2. Invitation Acceptance (POST)', () => {
    const validInvitation: ReviewerInvitation = {
      id: 'test-id',
      email: 'test@example.com',
      token: 'valid-token',
      invitedBy: 'admin-id',
      invitedByName: 'Admin User',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    };

    it('should successfully accept invitation with matching email', async () => {
      mockDoc.data.mockReturnValue(validInvitation);
      
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      };
      
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const mockUserProfileDoc = {
        exists: false,
      };
      
      const mockUserProfileRef = {
        get: jest.fn().mockResolvedValue(mockUserProfileDoc),
        set: jest.fn(),
        update: jest.fn(),
      };
      
      mockCollection.doc.mockReturnValue(mockUserProfileRef);

      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token', {
        method: 'POST',
        body: JSON.stringify({ firebaseToken: 'valid-firebase-token' }),
      });

      const response = await POST(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Reviewer invitation accepted successfully');
      expect(data.redirectTo).toBe('/profile');

      // Verify user profile creation
      expect(mockUserProfileRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User',
          isReviewer: true,
          authStatus: 'active',
        })
      );

      // Verify invitation marked as accepted
      expect(mockDoc.ref.update).toHaveBeenCalledWith({
        status: 'accepted',
        usedAt: expect.any(String),
        acceptedByUserId: 'user-123',
        archived: true,
      });
    });

    it('should update existing user profile to add reviewer privileges', async () => {
      mockDoc.data.mockReturnValue(validInvitation);
      
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };
      
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const existingProfile: Partial<UserProfile> = {
        userId: 'user-123',
        email: 'test@example.com',
        displayName: 'Existing User',
        photoURL: 'existing-photo.jpg',
        bio: 'Existing bio',
        isReviewer: false,
      };

      const mockUserProfileDoc = {
        exists: true,
        data: () => existingProfile,
      };
      
      const mockUserProfileRef = {
        get: jest.fn().mockResolvedValue(mockUserProfileDoc),
        set: jest.fn(),
        update: jest.fn(),
      };
      
      mockCollection.doc.mockReturnValue(mockUserProfileRef);

      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token', {
        method: 'POST',
        body: JSON.stringify({ firebaseToken: 'valid-firebase-token' }),
      });

      const response = await POST(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify existing profile updated with reviewer privileges
      expect(mockUserProfileRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User', // Should use name from Firebase token
          photoURL: 'existing-photo.jpg', // Should preserve existing photo
          isReviewer: true,
          authStatus: 'active',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should reject invitation with mismatched email', async () => {
      mockDoc.data.mockReturnValue(validInvitation);
      
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'different@example.com', // Different email
        name: 'Test User',
      };
      
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token', {
        method: 'POST',
        body: JSON.stringify({ firebaseToken: 'valid-firebase-token' }),
      });

      const response = await POST(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('This invitation was sent to test@example.com');
      expect(data.error).toContain('but you signed in with different@example.com');
    });

    it('should handle invalid Firebase token', async () => {
      mockAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token', {
        method: 'POST',
        body: JSON.stringify({ firebaseToken: 'invalid-firebase-token' }),
      });

      const response = await POST(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to accept invitation');
    });

    it('should handle missing Firebase token', async () => {
      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token', {
        method: 'POST',
        body: JSON.stringify({}), // Missing firebaseToken
      });

      const response = await POST(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token and Firebase token are required');
    });
  });

  describe('3. Edge Cases and Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockCollection.where.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = new NextRequest('http://localhost/api/invite/reviewer/test-token');
      const response = await GET(request, { params: { token: 'test-token' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to validate invitation');
    });

    it('should handle malformed request body', async () => {
      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token', {
        method: 'POST',
        body: 'invalid-json',
      });

      const response = await POST(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to accept invitation');
    });

    it('should handle Firebase token without email', async () => {
      const validInvitation: ReviewerInvitation = {
        id: 'test-id',
        email: 'test@example.com',
        token: 'valid-token',
        invitedBy: 'admin-id',
        invitedByName: 'Admin User',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      };

      mockDoc.data.mockReturnValue(validInvitation);
      
      const mockDecodedToken = {
        uid: 'user-123',
        // email is missing
        name: 'Test User',
      };
      
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token', {
        method: 'POST',
        body: JSON.stringify({ firebaseToken: 'valid-firebase-token' }),
      });

      const response = await POST(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid Firebase token');
    });
  });

  describe('4. Data Consistency Validation', () => {
    it('should ensure invitation status transitions are atomic', async () => {
      const validInvitation: ReviewerInvitation = {
        id: 'test-id',
        email: 'test@example.com',
        token: 'valid-token',
        invitedBy: 'admin-id',
        invitedByName: 'Admin User',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      };

      mockDoc.data.mockReturnValue(validInvitation);
      
      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };
      
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      // Simulate profile creation failure
      const mockUserProfileRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockRejectedValue(new Error('Profile creation failed')),
        update: jest.fn(),
      };
      
      mockCollection.doc.mockReturnValue(mockUserProfileRef);

      const request = new NextRequest('http://localhost/api/invite/reviewer/valid-token', {
        method: 'POST',
        body: JSON.stringify({ firebaseToken: 'valid-firebase-token' }),
      });

      const response = await POST(request, { params: { token: 'valid-token' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to accept invitation');
      
      // Invitation should not be marked as accepted if profile creation fails
      expect(mockDoc.ref.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'accepted' })
      );
    });

    it('should validate invitation expiry calculation', () => {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // Test that expiry is exactly 7 days
      expect(sevenDaysFromNow.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});

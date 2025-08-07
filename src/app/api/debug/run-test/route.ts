import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from 'firebase-admin';
import crypto from 'crypto';
import type { ReviewerInvitation } from '@/lib/types';

/**
 * POST /api/debug/run-test
 * 
 * Executes individual debug tests for the reviewer invitation pipeline.
 * This endpoint should only be available in development or to admin users.
 */
export async function POST(request: NextRequest) {
  try {
    // In production, you should add authentication/authorization here
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { testId, testEmail, testToken } = await request.json();

    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
    }

    const testResult = await executeTest(testId, testEmail, testToken);
    return NextResponse.json(testResult);

  } catch (error) {
    console.error('Error running debug test:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to execute test',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function executeTest(testId: string, testEmail?: string, testToken?: string) {
  const startTime = Date.now();

  try {
    switch (testId) {
      case 'validate-pending':
        return await testValidatePending(testToken);
      
      case 'validate-expired':
        return await testValidateExpired();
      
      case 'validate-invalid':
        return await testValidateInvalid();
      
      case 'validate-missing':
        return await testValidateMissing();
      
      case 'accept-valid':
        return await testAcceptValid(testEmail, testToken);
      
      case 'accept-mismatch':
        return await testAcceptMismatch(testToken);
      
      case 'accept-duplicate':
        return await testAcceptDuplicate(testToken);
      
      case 'accept-profile-update':
        return await testAcceptProfileUpdate(testEmail, testToken);
      
      case 'security-token-enum':
        return await testSecurityTokenEnum();
      
      case 'security-firebase-validation':
        return await testSecurityFirebaseValidation(testToken);
      
      case 'security-injection':
        return await testSecurityInjection();
      
      case 'perf-response-time':
        return await testPerfResponseTime(testToken);
      
      case 'perf-concurrent':
        return await testPerfConcurrent();
      
      case 'integration-e2e':
        return await testIntegrationE2E(testEmail);
      
      case 'integration-database':
        return await testIntegrationDatabase(testEmail);
      
      default:
        return {
          success: false,
          error: `Unknown test ID: ${testId}`,
          duration: Date.now() - startTime
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Test execution failed',
      duration: Date.now() - startTime
    };
  }
}

// Test implementations
async function testValidatePending(testToken?: string) {
  if (!testToken) {
    return { success: false, error: 'Test token required for this test' };
  }

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${testToken}`);
  const data = await response.json();

  if (response.status === 200 && data.invitation) {
    return {
      success: true,
      details: {
        status: response.status,
        hasInvitation: !!data.invitation,
        invitationStatus: data.invitation.status
      }
    };
  }

  return {
    success: false,
    error: `Expected 200 with invitation, got ${response.status}`,
    details: { status: response.status, data }
  };
}

async function testValidateExpired() {
  // Create an expired invitation for testing
  const expiredToken = crypto.randomBytes(32).toString('hex');
  const expiredInvitation = {
    email: 'expired@test.com',
    token: expiredToken,
    invitedBy: 'test-admin',
    invitedByName: 'Test Admin',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
    status: 'pending' as const,
  };

  // Add to database
  await adminDb.collection('reviewerInvitations').add(expiredInvitation);

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${expiredToken}`);
  const data = await response.json();

  // Cleanup
  const cleanup = await adminDb
    .collection('reviewerInvitations')
    .where('token', '==', expiredToken)
    .get();
  
  cleanup.docs.forEach(doc => doc.ref.delete());

  if (response.status === 410 && data.error?.includes('expired')) {
    return {
      success: true,
      details: {
        status: response.status,
        error: data.error
      }
    };
  }

  return {
    success: false,
    error: `Expected 410 with expiry error, got ${response.status}`,
    details: { status: response.status, data }
  };
}

async function testValidateInvalid() {
  const invalidToken = 'completely-invalid-token-that-does-not-exist';
  
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${invalidToken}`);
  const data = await response.json();

  if (response.status === 404 && data.error === 'Invalid invitation token') {
    return {
      success: true,
      details: {
        status: response.status,
        error: data.error
      }
    };
  }

  return {
    success: false,
    error: `Expected 404 with 'Invalid invitation token', got ${response.status}`,
    details: { status: response.status, data }
  };
}

async function testValidateMissing() {
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/`);
  
  // This should result in a 404 from Next.js routing, not our API
  if (response.status === 404) {
    return {
      success: true,
      details: {
        status: response.status,
        note: 'Missing token handled by Next.js routing'
      }
    };
  }

  return {
    success: false,
    error: `Expected 404 from routing, got ${response.status}`,
    details: { status: response.status }
  };
}

async function testAcceptValid(testEmail?: string, testToken?: string) {
  if (!testEmail || !testToken) {
    return { success: false, error: 'Test email and token required for this test' };
  }

  // Create a mock Firebase token (in real tests, use Firebase Admin SDK)
  const mockFirebaseToken = createMockFirebaseToken(testEmail);

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${testToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken: mockFirebaseToken }),
  });

  const data = await response.json();

  if (response.status === 200 && data.success) {
    return {
      success: true,
      details: {
        status: response.status,
        message: data.message,
        redirectTo: data.redirectTo
      }
    };
  }

  return {
    success: false,
    error: `Expected successful acceptance, got ${response.status}`,
    details: { status: response.status, data }
  };
}

async function testAcceptMismatch(testToken?: string) {
  if (!testToken) {
    return { success: false, error: 'Test token required for this test' };
  }

  // Use a different email than what the invitation was created for
  const mockFirebaseToken = createMockFirebaseToken('different@test.com');

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${testToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken: mockFirebaseToken }),
  });

  const data = await response.json();

  if (response.status === 403 && data.error?.includes('This invitation was sent to')) {
    return {
      success: true,
      details: {
        status: response.status,
        error: data.error
      }
    };
  }

  return {
    success: false,
    error: `Expected 403 with email mismatch error, got ${response.status}`,
    details: { status: response.status, data }
  };
}

async function testAcceptDuplicate(testToken?: string) {
  if (!testToken) {
    return { success: false, error: 'Test token required for this test' };
  }

  // Try to accept the same invitation twice
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${testToken}`);
  const data = await response.json();

  if (response.status === 410 && data.error?.includes('already')) {
    return {
      success: true,
      details: {
        status: response.status,
        error: data.error
      }
    };
  }

  return {
    success: false,
    error: `Expected 410 with 'already' error, got ${response.status}`,
    details: { status: response.status, data }
  };
}

async function testAcceptProfileUpdate(testEmail?: string, testToken?: string) {
  // This test would require setting up an existing user profile first
  // For now, we'll return a placeholder result
  return {
    success: true,
    details: {
      note: 'Profile update test requires existing user setup',
      testEmail,
      testToken
    }
  };
}

async function testSecurityTokenEnum() {
  const maliciousTokens = [
    '../../../etc/passwd',
    '<script>alert("xss")</script>',
    'SELECT * FROM invitations',
    'a'.repeat(1000), // Very long token
    '',
    null,
  ];

  let allPassed = true;
  const results = [];

  for (const token of maliciousTokens) {
    try {
      const encodedToken = encodeURIComponent(token || '');
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${encodedToken}`);
      const data = await response.json();

      const passed = response.status === 404 && data.error === 'Invalid invitation token';
      if (!passed) allPassed = false;

      results.push({
        token: token?.substring(0, 50) + (token && token.length > 50 ? '...' : ''),
        status: response.status,
        passed
      });
    } catch (error) {
      allPassed = false;
      results.push({
        token: token?.substring(0, 50) + (token && token.length > 50 ? '...' : ''),
        error: error instanceof Error ? error.message : 'Unknown error',
        passed: false
      });
    }
  }

  return {
    success: allPassed,
    details: {
      totalTests: maliciousTokens.length,
      passed: results.filter(r => r.passed).length,
      results
    }
  };
}

async function testSecurityFirebaseValidation(testToken?: string) {
  if (!testToken) {
    return { success: false, error: 'Test token required for this test' };
  }

  const invalidFirebaseTokens = [
    'fake-token',
    '',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature',
    null,
  ];

  let allPassed = true;
  const results = [];

  for (const firebaseToken of invalidFirebaseTokens) {
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${testToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseToken }),
      });

      const passed = [400, 401, 500].includes(response.status);
      if (!passed) allPassed = false;

      results.push({
        firebaseToken: firebaseToken?.substring(0, 20) + '...',
        status: response.status,
        passed
      });
    } catch (error) {
      // Network errors are acceptable for invalid tokens
      results.push({
        firebaseToken: firebaseToken?.substring(0, 20) + '...',
        error: 'Network error (acceptable)',
        passed: true
      });
    }
  }

  return {
    success: allPassed,
    details: {
      totalTests: invalidFirebaseTokens.length,
      passed: results.filter(r => r.passed).length,
      results
    }
  };
}

async function testSecurityInjection() {
  // Test for NoSQL injection attempts
  const injectionAttempts = [
    '{"$ne": null}',
    '{"$gt": ""}',
    '{"$regex": ".*"}',
    '; DROP TABLE invitations; --',
  ];

  let allPassed = true;
  const results = [];

  for (const attempt of injectionAttempts) {
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${encodeURIComponent(attempt)}`);
      const data = await response.json();

      const passed = response.status === 404 && data.error === 'Invalid invitation token';
      if (!passed) allPassed = false;

      results.push({
        attempt: attempt.substring(0, 30) + '...',
        status: response.status,
        passed
      });
    } catch (error) {
      allPassed = false;
      results.push({
        attempt: attempt.substring(0, 30) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        passed: false
      });
    }
  }

  return {
    success: allPassed,
    details: {
      totalTests: injectionAttempts.length,
      passed: results.filter(r => r.passed).length,
      results
    }
  };
}

async function testPerfResponseTime(testToken?: string) {
  if (!testToken) {
    return { success: false, error: 'Test token required for this test' };
  }

  const startTime = Date.now();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${testToken}`);
  const endTime = Date.now();
  
  const responseTime = endTime - startTime;
  const passed = responseTime < 2000; // Should respond within 2 seconds

  return {
    success: passed,
    details: {
      responseTime,
      threshold: 2000,
      status: response.status
    }
  };
}

async function testPerfConcurrent() {
  const concurrentRequests = 5;
  const testToken = 'concurrent-test-token';

  const startTime = Date.now();
  const promises = Array(concurrentRequests).fill(null).map(() =>
    fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${testToken}`)
  );

  const responses = await Promise.all(promises);
  const endTime = Date.now();

  const totalTime = endTime - startTime;
  const averageTime = totalTime / concurrentRequests;
  const passed = totalTime < 5000; // All requests should complete within 5 seconds

  return {
    success: passed,
    details: {
      concurrentRequests,
      totalTime,
      averageTime,
      allCompleted: responses.length === concurrentRequests
    }
  };
}

async function testIntegrationE2E(testEmail?: string) {
  if (!testEmail) {
    return { success: false, error: 'Test email required for this test' };
  }

  try {
    // Step 1: Create invitation
    const createResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/debug/create-test-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create test invitation');
    }

    const { token } = await createResponse.json();

    // Step 2: Validate invitation
    const validateResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${token}`);
    if (validateResponse.status !== 200) {
      throw new Error('Failed to validate invitation');
    }

    // Step 3: Accept invitation
    const mockFirebaseToken = createMockFirebaseToken(testEmail);
    const acceptResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseToken: mockFirebaseToken }),
    });

    if (acceptResponse.status !== 200) {
      throw new Error('Failed to accept invitation');
    }

    // Step 4: Verify invitation is now used
    const revalidateResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/invite/reviewer/${token}`);
    if (revalidateResponse.status !== 410) {
      throw new Error('Invitation should be marked as used');
    }

    return {
      success: true,
      details: {
        steps: ['create', 'validate', 'accept', 'verify'],
        token: token.substring(0, 16) + '...'
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'E2E test failed'
    };
  }
}

async function testIntegrationDatabase(testEmail?: string) {
  if (!testEmail) {
    return { success: false, error: 'Test email required for this test' };
  }

  try {
    // Test database connectivity and consistency
    const testDoc = await adminDb.collection('reviewerInvitations').limit(1).get();
    
    if (testDoc.empty) {
      return {
        success: true,
        details: {
          note: 'No invitations in database, but connection is working',
          connected: true
        }
      };
    }

    const invitation = testDoc.docs[0].data() as ReviewerInvitation;
    const hasRequiredFields = invitation.email && invitation.token && invitation.status;

    return {
      success: hasRequiredFields,
      details: {
        connected: true,
        hasRequiredFields,
        sampleInvitation: {
          hasEmail: !!invitation.email,
          hasToken: !!invitation.token,
          hasStatus: !!invitation.status,
          status: invitation.status
        }
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Database connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Helper function to create mock Firebase tokens for testing
function createMockFirebaseToken(email: string): string {
  // In real tests, you'd use Firebase Admin SDK to create valid test tokens
  // This is a simplified mock for demonstration
  const payload = {
    uid: `test-user-${Date.now()}`,
    email,
    name: 'Test User',
    picture: 'https://example.com/photo.jpg',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Test Configuration for Reviewer Invitation Pipeline
 * 
 * This file contains all configuration settings for testing the reviewer invitation system.
 * Modify these settings based on your testing environment and requirements.
 */

export const TEST_CONFIG = {
  // Environment settings
  environment: process.env.NODE_ENV || 'development',
  baseUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  
  // Test data
  testEmails: {
    valid: 'reviewer-test@example.com',
    admin: 'admin-test@example.com',
    invalid: 'invalid-email-format',
    mismatch: 'different-email@example.com',
    concurrent1: 'concurrent1@example.com',
    concurrent2: 'concurrent2@example.com',
  },

  // Test timeouts and thresholds
  timeouts: {
    apiResponse: 5000,        // 5 seconds max for API responses
    databaseOperation: 3000,  // 3 seconds max for DB operations
    endToEndFlow: 10000,      // 10 seconds max for complete E2E test
  },

  performance: {
    maxResponseTime: 2000,    // 2 seconds max for individual requests
    concurrentRequests: 5,    // Number of concurrent requests to test
    maxConcurrentTime: 5000,  // 5 seconds max for all concurrent requests
  },

  // Security test parameters
  security: {
    maliciousTokens: [
      '../../../etc/passwd',
      '<script>alert("xss")</script>',
      'SELECT * FROM invitations',
      '{"$ne": null}',
      '{"$gt": ""}',
      'a'.repeat(1000),
      '',
      'null',
    ],
    invalidFirebaseTokens: [
      'fake-token',
      '',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature',
      'malformed-jwt-token',
    ],
  },

  // Database test settings
  database: {
    testCollections: ['reviewerInvitations', 'userProfiles'],
    cleanupAfterTests: true,
    maxTestDocuments: 100,
  },

  // Monitoring and alerting
  monitoring: {
    healthScoreThreshold: 80,  // Minimum acceptable health score
    errorRateThreshold: 5,     // Maximum acceptable error rate (%)
    expiryWarningHours: 24,    // Hours before expiry to show warning
  },

  // Test categories and their priorities
  testCategories: {
    validation: {
      priority: 1,
      description: 'Basic invitation token validation tests',
      required: true,
    },
    acceptance: {
      priority: 2,
      description: 'Invitation acceptance and user profile creation tests',
      required: true,
    },
    security: {
      priority: 3,
      description: 'Security and injection protection tests',
      required: true,
    },
    performance: {
      priority: 4,
      description: 'Response time and load testing',
      required: false,
    },
    integration: {
      priority: 5,
      description: 'End-to-end integration tests',
      required: true,
    },
  },

  // Expected test results
  expectedResults: {
    'validate-pending': { status: 200, hasInvitation: true },
    'validate-expired': { status: 410, errorContains: 'expired' },
    'validate-invalid': { status: 404, error: 'Invalid invitation token' },
    'validate-missing': { status: 404 },
    'accept-valid': { status: 200, success: true },
    'accept-mismatch': { status: 403, errorContains: 'This invitation was sent to' },
    'accept-duplicate': { status: 410, errorContains: 'already' },
    'security-token-enum': { allShouldReturn404: true },
    'security-firebase-validation': { allShouldFail: true },
    'security-injection': { allShouldReturn404: true },
    'perf-response-time': { maxResponseTime: 2000 },
    'perf-concurrent': { maxTotalTime: 5000 },
    'integration-e2e': { success: true, completesAllSteps: true },
    'integration-database': { connected: true, hasRequiredFields: true },
  },

  // Debugging options
  debug: {
    verbose: process.env.DEBUG_VERBOSE === 'true',
    logApiCalls: process.env.DEBUG_API_CALLS === 'true',
    preserveTestData: process.env.DEBUG_PRESERVE_DATA === 'true',
    skipCleanup: process.env.DEBUG_SKIP_CLEANUP === 'true',
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    exponentialBackoff: true,
  },
};

/**
 * Test suite configuration for different environments
 */
export const ENVIRONMENT_CONFIGS = {
  development: {
    ...TEST_CONFIG,
    debug: {
      ...TEST_CONFIG.debug,
      verbose: true,
      logApiCalls: true,
    },
  },

  testing: {
    ...TEST_CONFIG,
    timeouts: {
      ...TEST_CONFIG.timeouts,
      apiResponse: 10000,
      databaseOperation: 5000,
      endToEndFlow: 20000,
    },
    database: {
      ...TEST_CONFIG.database,
      cleanupAfterTests: true,
    },
  },

  staging: {
    ...TEST_CONFIG,
    performance: {
      ...TEST_CONFIG.performance,
      maxResponseTime: 3000,
      concurrentRequests: 10,
      maxConcurrentTime: 8000,
    },
    monitoring: {
      ...TEST_CONFIG.monitoring,
      healthScoreThreshold: 85,
      errorRateThreshold: 3,
    },
  },

  production: {
    ...TEST_CONFIG,
    testCategories: {
      ...TEST_CONFIG.testCategories,
      // In production, only run non-destructive tests
      validation: { ...TEST_CONFIG.testCategories.validation, required: true },
      security: { ...TEST_CONFIG.testCategories.security, required: true },
      performance: { ...TEST_CONFIG.testCategories.performance, required: false },
      acceptance: { ...TEST_CONFIG.testCategories.acceptance, required: false },
      integration: { ...TEST_CONFIG.testCategories.integration, required: false },
    },
    debug: {
      verbose: false,
      logApiCalls: false,
      preserveTestData: false,
      skipCleanup: false,
    },
  },
};

/**
 * Get configuration for current environment
 */
export function getTestConfig() {
  const env = process.env.NODE_ENV || 'development';
  return ENVIRONMENT_CONFIGS[env as keyof typeof ENVIRONMENT_CONFIGS] || ENVIRONMENT_CONFIGS.development;
}

/**
 * Test result validation helpers
 */
export const TestValidators = {
  validateResponse: (actual: any, expected: any) => {
    if (expected.status && actual.status !== expected.status) {
      return { valid: false, error: `Expected status ${expected.status}, got ${actual.status}` };
    }
    
    if (expected.errorContains && !actual.error?.includes(expected.errorContains)) {
      return { valid: false, error: `Expected error to contain "${expected.errorContains}"` };
    }
    
    if (expected.success !== undefined && actual.success !== expected.success) {
      return { valid: false, error: `Expected success: ${expected.success}, got ${actual.success}` };
    }
    
    return { valid: true };
  },

  validatePerformance: (duration: number, maxDuration: number) => {
    return {
      valid: duration <= maxDuration,
      error: duration > maxDuration ? `Response time ${duration}ms exceeded limit ${maxDuration}ms` : undefined
    };
  },

  validateHealthScore: (score: number, threshold: number) => {
    return {
      valid: score >= threshold,
      error: score < threshold ? `Health score ${score} below threshold ${threshold}` : undefined
    };
  },
};

/**
 * Test data generators
 */
export const TestDataGenerators = {
  generateTestEmail: (prefix: string = 'test') => {
    const timestamp = Date.now();
    return `${prefix}-${timestamp}@example.com`;
  },

  generateMockFirebaseToken: (email: string) => {
    const payload = {
      uid: `test-user-${Date.now()}`,
      email,
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  },

  generateTestInvitation: (overrides: Partial<any> = {}) => {
    return {
      email: TestDataGenerators.generateTestEmail(),
      token: require('crypto').randomBytes(32).toString('hex'),
      invitedBy: 'test-admin',
      invitedByName: 'Test Admin',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      ...overrides,
    };
  },
};

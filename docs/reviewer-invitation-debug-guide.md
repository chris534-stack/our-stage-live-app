# Reviewer Invitation Pipeline Debug Guide

## Overview

This comprehensive debug system ensures the reviewer invitation pipeline is foolproof by providing automated testing, real-time monitoring, and detailed diagnostics for every aspect of the invitation flow.

## Components

### 1. Test Suites

#### Unit Tests (`src/tests/reviewer-invitation-debug.test.ts`)
- **Purpose**: Test individual API endpoints and functions in isolation
- **Coverage**: 
  - Token validation (valid, expired, invalid, missing)
  - Invitation acceptance (valid, email mismatch, duplicate attempts)
  - Error handling and edge cases
  - Database consistency
- **Run Command**: `npm test reviewer-invitation-debug.test.ts`

#### Integration Tests (`src/tests/reviewer-invitation-integration.test.ts`)
- **Purpose**: Test complete end-to-end workflows
- **Coverage**:
  - Full invitation lifecycle (create → validate → accept → verify)
  - Concurrent access scenarios
  - Performance under load
  - Security vulnerability testing
- **Run Command**: `npm test reviewer-invitation-integration.test.ts`

### 2. Debug Dashboard (`src/components/debug/ReviewerInvitationDebugDashboard.tsx`)

#### Features
- **Real-time Statistics**: Live monitoring of invitation metrics
- **Interactive Testing**: Run individual or all tests with one click
- **Test Configuration**: Customize test parameters and scenarios
- **Visual Results**: Color-coded test results with detailed error information

#### Access
- Navigate to `/admin/debug/reviewer-invitations` (admin only)
- Or integrate into your existing admin dashboard

### 3. Debug API Endpoints

#### Statistics Endpoint (`/api/debug/reviewer-invitation-stats`)
```typescript
GET /api/debug/reviewer-invitation-stats
```
**Returns:**
- Total invitations count
- Acceptance/expiry rates
- Average acceptance time
- Health score (0-100)
- Recent activity metrics
- Top inviters analysis

#### Test Runner Endpoint (`/api/debug/run-test`)
```typescript
POST /api/debug/run-test
Body: { testId: string, testEmail?: string, testToken?: string }
```
**Executes individual tests:**
- Validation tests
- Acceptance tests
- Security tests
- Performance tests
- Integration tests

#### Test Invitation Creator (`/api/debug/create-test-invitation`)
```typescript
POST /api/debug/create-test-invitation
Body: { email: string }
```
**Creates test invitations for debugging**

## Test Categories

### 1. Validation Tests
- ✅ **validate-pending**: Tests valid pending invitation tokens
- ✅ **validate-expired**: Tests expired invitation handling
- ✅ **validate-invalid**: Tests invalid token responses
- ✅ **validate-missing**: Tests missing token parameter handling

### 2. Acceptance Tests
- ✅ **accept-valid**: Tests successful invitation acceptance
- ✅ **accept-mismatch**: Tests email mismatch rejection
- ✅ **accept-duplicate**: Tests duplicate acceptance prevention
- ✅ **accept-profile-update**: Tests existing profile updates

### 3. Security Tests
- 🔒 **security-token-enum**: Tests token enumeration protection
- 🔒 **security-firebase-validation**: Tests Firebase token validation
- 🔒 **security-injection**: Tests injection attack protection

### 4. Performance Tests
- ⚡ **perf-response-time**: Tests API response times
- ⚡ **perf-concurrent**: Tests concurrent request handling

### 5. Integration Tests
- 🔄 **integration-e2e**: Tests complete invitation lifecycle
- 🔄 **integration-database**: Tests database consistency

## Usage Instructions

### Running All Tests

#### Via Command Line
```bash
# Run unit tests
npm test reviewer-invitation-debug.test.ts

# Run integration tests
npm test reviewer-invitation-integration.test.ts

# Run all reviewer invitation tests
npm test -- --testPathPattern=reviewer-invitation
```

#### Via Debug Dashboard
1. Navigate to the debug dashboard
2. Click "Run All Tests"
3. Monitor progress in real-time
4. Review detailed results

### Running Individual Tests

#### Via API
```bash
curl -X POST http://localhost:3000/api/debug/run-test \
  -H "Content-Type: application/json" \
  -d '{"testId": "validate-pending", "testToken": "your-test-token"}'
```

#### Via Dashboard
1. Select the specific test category tab
2. Click "Run" next to the desired test
3. View results immediately

### Creating Test Data

```bash
# Create a test invitation
curl -X POST http://localhost:3000/api/debug/create-test-invitation \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

## Monitoring and Alerts

### Health Score Calculation
The system calculates a health score (0-100) based on:
- **Acceptance Rate** (40% weight): Higher is better
- **Expiry Rate** (30% weight): Lower is better  
- **Error Rate** (30% weight): Lower is better

### Thresholds
- **Healthy**: Score ≥ 80
- **Warning**: Score 60-79
- **Critical**: Score < 60

### Real-time Monitoring
Enable real-time monitoring in the dashboard to:
- Track invitation statistics every 5 seconds
- Get immediate alerts for failing tests
- Monitor system performance continuously

## Troubleshooting

### Common Issues

#### Test Failures
1. **Database Connection**: Ensure Firebase Admin SDK is properly configured
2. **Invalid Tokens**: Check that test invitations are being created correctly
3. **Timeout Errors**: Increase timeout values in test configuration
4. **Permission Errors**: Verify admin authentication for debug endpoints

#### Performance Issues
1. **Slow Response Times**: Check database indexing and connection pool
2. **Concurrent Request Failures**: Review rate limiting and resource allocation
3. **Memory Leaks**: Monitor test cleanup and resource disposal

### Debug Configuration

Edit `src/tests/reviewer-invitation.config.ts` to customize:

```typescript
export const TEST_CONFIG = {
  timeouts: {
    apiResponse: 5000,        // Increase if tests timeout
    databaseOperation: 3000,  // Increase for slow DB
    endToEndFlow: 10000,      // Increase for complex flows
  },
  
  performance: {
    maxResponseTime: 2000,    // Adjust based on requirements
    concurrentRequests: 5,    // Reduce if system can't handle load
  },
  
  debug: {
    verbose: true,            // Enable detailed logging
    logApiCalls: true,        // Log all API requests
    preserveTestData: false,  // Keep test data for inspection
  },
};
```

## Security Considerations

### Production Safety
- Debug endpoints are protected by authentication in production
- Test data is automatically cleaned up
- Sensitive information is never logged
- Rate limiting prevents abuse

### Test Data Isolation
- All test invitations are marked with `invitedBy: 'debug-system'`
- Test user profiles use predictable email patterns
- Cleanup procedures target only test data

## Continuous Integration

### GitHub Actions Integration
```yaml
name: Reviewer Invitation Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test reviewer-invitation
      - name: Upload test results
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: test-results/
```

### Automated Monitoring
Set up scheduled tests to run:
- **Every hour**: Basic validation tests
- **Every 6 hours**: Full test suite
- **Daily**: Performance and security tests

## Metrics and Reporting

### Key Metrics Tracked
- **Invitation Creation Rate**: Invitations created per hour/day
- **Acceptance Rate**: Percentage of invitations accepted
- **Time to Acceptance**: Average time from creation to acceptance
- **Expiry Rate**: Percentage of invitations that expire unused
- **Error Rate**: Percentage of failed operations
- **Response Times**: API endpoint performance metrics

### Reporting
- **Dashboard**: Real-time metrics and test results
- **Email Alerts**: Automated notifications for critical issues
- **Weekly Reports**: Comprehensive system health summaries
- **Audit Logs**: Detailed operation history for compliance

## Best Practices

### Testing
1. **Run tests before deployments**
2. **Test in staging environment first**
3. **Monitor production metrics continuously**
4. **Keep test data separate from production data**

### Maintenance
1. **Regular cleanup of expired invitations**
2. **Monitor database performance**
3. **Update test scenarios as features evolve**
4. **Review security tests quarterly**

### Development
1. **Use debug dashboard during development**
2. **Write tests for new features**
3. **Validate edge cases thoroughly**
4. **Document any configuration changes**

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review test logs for detailed error information
3. Use the debug dashboard for interactive testing
4. Contact the development team with specific error messages

---

This debug system ensures your reviewer invitation pipeline is robust, secure, and reliable. Regular use of these tools will help maintain system health and quickly identify any issues before they affect users.

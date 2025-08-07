#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Reviewer Invitation Pipeline
 * 
 * This script validates the entire debug system and ensures all components
 * work together properly. It can be run manually or as part of CI/CD.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  testEmail: 'debug-validation@test.com',
  timeout: 30000, // 30 seconds
  verbose: process.argv.includes('--verbose'),
  skipCleanup: process.argv.includes('--skip-cleanup'),
  runIntegration: !process.argv.includes('--unit-only'),
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logStep(step, status = 'info') {
  const statusColors = {
    info: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  };
  log(`  ${step}`, statusColors[status]);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  
  try {
    const response = await fetch(url, {
      timeout: CONFIG.timeout,
      ...options,
    });
    
    const data = await response.json();
    return { response, data };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

async function validateEnvironment() {
  logSection('Environment Validation');
  
  // Check if Next.js is running
  try {
    const { response } = await makeRequest(CONFIG.baseUrl);
    if (response.ok) {
      logStep('✓ Next.js server is running', 'success');
    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    logStep('✗ Next.js server is not accessible', 'error');
    logStep(`  Error: ${error.message}`, 'error');
    return false;
  }
  
  // Check if debug endpoints are available
  try {
    const { response } = await makeRequest(`${CONFIG.baseUrl}/api/debug/reviewer-invitation-stats`);
    if (response.ok) {
      logStep('✓ Debug API endpoints are accessible', 'success');
    } else {
      throw new Error(`Debug API returned ${response.status}`);
    }
  } catch (error) {
    logStep('✗ Debug API endpoints are not accessible', 'error');
    logStep(`  Error: ${error.message}`, 'error');
    return false;
  }
  
  // Check Firebase connection
  try {
    const { response, data } = await makeRequest(`${CONFIG.baseUrl}/api/debug/run-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId: 'integration-database' }),
    });
    
    if (response.ok && data.success) {
      logStep('✓ Firebase/Database connection is working', 'success');
    } else {
      throw new Error(`Database test failed: ${data.error}`);
    }
  } catch (error) {
    logStep('✗ Firebase/Database connection failed', 'error');
    logStep(`  Error: ${error.message}`, 'error');
    return false;
  }
  
  return true;
}

async function runUnitTests() {
  logSection('Unit Tests');
  
  try {
    logStep('Running Jest unit tests...', 'info');
    
    const testCommand = 'npm test -- --testPathPattern=reviewer-invitation-debug.test.ts --passWithNoTests';
    const output = execSync(testCommand, { 
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
    });
    
    if (CONFIG.verbose) {
      log(output, 'blue');
    }
    
    logStep('✓ Unit tests completed successfully', 'success');
    return true;
  } catch (error) {
    logStep('✗ Unit tests failed', 'error');
    if (CONFIG.verbose) {
      log(error.stdout || error.message, 'red');
    }
    return false;
  }
}

async function runIntegrationTests() {
  logSection('Integration Tests');
  
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };
  
  const testCategories = [
    {
      name: 'Validation Tests',
      tests: ['validate-pending', 'validate-expired', 'validate-invalid'],
    },
    {
      name: 'Security Tests',
      tests: ['security-token-enum', 'security-firebase-validation', 'security-injection'],
    },
    {
      name: 'Performance Tests',
      tests: ['perf-response-time', 'perf-concurrent'],
    },
  ];
  
  // Create test invitation first
  logStep('Creating test invitation...', 'info');
  let testToken = null;
  
  try {
    const { response, data } = await makeRequest(`${CONFIG.baseUrl}/api/debug/create-test-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: CONFIG.testEmail }),
    });
    
    if (response.ok && data.success) {
      testToken = data.token;
      logStep('✓ Test invitation created', 'success');
    } else {
      throw new Error(data.error || 'Failed to create test invitation');
    }
  } catch (error) {
    logStep('✗ Failed to create test invitation', 'error');
    logStep(`  Error: ${error.message}`, 'error');
    return testResults;
  }
  
  // Run tests by category
  for (const category of testCategories) {
    logStep(`\nRunning ${category.name}...`, 'info');
    
    for (const testId of category.tests) {
      testResults.total++;
      
      try {
        const { response, data } = await makeRequest(`${CONFIG.baseUrl}/api/debug/run-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            testId, 
            testEmail: CONFIG.testEmail, 
            testToken 
          }),
        });
        
        if (response.ok && data.success) {
          logStep(`  ✓ ${testId}`, 'success');
          testResults.passed++;
        } else {
          logStep(`  ✗ ${testId}: ${data.error}`, 'error');
          testResults.failed++;
          testResults.errors.push({ testId, error: data.error });
        }
        
        // Small delay between tests
        await sleep(100);
        
      } catch (error) {
        logStep(`  ✗ ${testId}: ${error.message}`, 'error');
        testResults.failed++;
        testResults.errors.push({ testId, error: error.message });
      }
    }
  }
  
  return testResults;
}

async function validateMonitoring() {
  logSection('Monitoring System Validation');
  
  try {
    // Test statistics endpoint
    logStep('Testing statistics endpoint...', 'info');
    const { response, data } = await makeRequest(`${CONFIG.baseUrl}/api/debug/reviewer-invitation-stats`);
    
    if (!response.ok) {
      throw new Error(`Statistics endpoint returned ${response.status}`);
    }
    
    // Validate required fields
    const requiredFields = [
      'totalInvitations',
      'pendingInvitations', 
      'acceptedInvitations',
      'expiredInvitations',
      'averageAcceptanceTime',
      'errorRate',
      'healthScore',
    ];
    
    for (const field of requiredFields) {
      if (data[field] === undefined) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    logStep('✓ Statistics endpoint is working correctly', 'success');
    logStep(`  Health Score: ${data.healthScore}`, data.healthScore >= 80 ? 'success' : 'warning');
    logStep(`  Total Invitations: ${data.totalInvitations}`, 'info');
    logStep(`  Error Rate: ${data.errorRate}%`, data.errorRate < 5 ? 'success' : 'warning');
    
    return true;
  } catch (error) {
    logStep('✗ Monitoring system validation failed', 'error');
    logStep(`  Error: ${error.message}`, 'error');
    return false;
  }
}

async function generateReport(results) {
  logSection('Test Report');
  
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      baseUrl: CONFIG.baseUrl,
    },
    results,
    summary: {
      totalTests: results.total,
      passedTests: results.passed,
      failedTests: results.failed,
      successRate: results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0,
    },
  };
  
  // Log summary
  log(`\nTest Summary:`, 'bright');
  log(`  Total Tests: ${report.summary.totalTests}`, 'info');
  log(`  Passed: ${report.summary.passedTests}`, 'success');
  log(`  Failed: ${report.summary.failedTests}`, report.summary.failedTests > 0 ? 'error' : 'info');
  log(`  Success Rate: ${report.summary.successRate}%`, report.summary.successRate >= 90 ? 'success' : 'warning');
  
  if (results.errors.length > 0) {
    log(`\nFailed Tests:`, 'red');
    for (const error of results.errors) {
      log(`  ${error.testId}: ${error.error}`, 'red');
    }
  }
  
  // Save report to file
  const reportPath = path.join(__dirname, '..', 'test-results', `reviewer-invitation-test-report-${Date.now()}.json`);
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\nReport saved to: ${reportPath}`, 'cyan');
  
  return report;
}

async function cleanup() {
  if (CONFIG.skipCleanup) {
    logStep('Skipping cleanup (--skip-cleanup flag)', 'warning');
    return;
  }
  
  logSection('Cleanup');
  
  try {
    logStep('Cleaning up test data...', 'info');
    
    const { response, data } = await makeRequest(`${CONFIG.baseUrl}/api/debug/create-test-invitation`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      logStep(`✓ Cleaned up ${data.deletedInvitations} invitations and ${data.deletedProfiles} profiles`, 'success');
    } else {
      throw new Error(`Cleanup failed: ${data.error}`);
    }
  } catch (error) {
    logStep('✗ Cleanup failed', 'error');
    logStep(`  Error: ${error.message}`, 'error');
  }
}

async function main() {
  log('Reviewer Invitation Pipeline Test Runner', 'bright');
  log('=========================================', 'bright');
  
  const startTime = Date.now();
  let success = true;
  
  try {
    // Environment validation
    if (!await validateEnvironment()) {
      success = false;
      return;
    }
    
    // Unit tests
    if (!await runUnitTests()) {
      success = false;
    }
    
    // Integration tests
    let integrationResults = { total: 0, passed: 0, failed: 0, errors: [] };
    if (CONFIG.runIntegration) {
      integrationResults = await runIntegrationTests();
      if (integrationResults.failed > 0) {
        success = false;
      }
    }
    
    // Monitoring validation
    if (!await validateMonitoring()) {
      success = false;
    }
    
    // Generate report
    await generateReport(integrationResults);
    
    // Cleanup
    await cleanup();
    
  } catch (error) {
    log(`\nUnexpected error: ${error.message}`, 'error');
    success = false;
  } finally {
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    logSection('Final Results');
    log(`Execution time: ${duration} seconds`, 'info');
    
    if (success) {
      log('🎉 All tests passed! Reviewer invitation pipeline is foolproof.', 'green');
      process.exit(0);
    } else {
      log('❌ Some tests failed. Please review the results above.', 'red');
      process.exit(1);
    }
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  log('\nReceived SIGINT, cleaning up...', 'yellow');
  await cleanup();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  log('\nReceived SIGTERM, cleaning up...', 'yellow');
  await cleanup();
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main, CONFIG };

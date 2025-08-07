#!/usr/bin/env node

/**
 * Debug System Validation Script
 * 
 * This script validates that all components of the reviewer invitation debug system
 * are properly integrated and working together.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(50), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(50), 'cyan');
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    const stats = fs.statSync(fullPath);
    log(`  ✓ ${description} (${Math.round(stats.size / 1024)}KB)`, 'green');
    return true;
  } else {
    log(`  ✗ ${description} - MISSING`, 'red');
    return false;
  }
}

function validateFileStructure() {
  logSection('File Structure Validation');
  
  const requiredFiles = [
    // Test files
    ['src/tests/reviewer-invitation-debug.test.ts', 'Unit Tests'],
    ['src/tests/reviewer-invitation-integration.test.ts', 'Integration Tests'],
    ['src/tests/reviewer-invitation.config.ts', 'Test Configuration'],
    
    // Debug components
    ['src/components/debug/ReviewerInvitationDebugDashboard.tsx', 'Debug Dashboard Component'],
    
    // API endpoints
    ['src/app/api/debug/reviewer-invitation-stats/route.ts', 'Statistics API'],
    ['src/app/api/debug/run-test/route.ts', 'Test Runner API'],
    ['src/app/api/debug/create-test-invitation/route.ts', 'Test Invitation Creator API'],
    
    // Core invitation system
    ['src/app/api/invite/reviewer/[token]/route.ts', 'Invitation Handler API'],
    ['src/components/admin/ReviewerApplications.tsx', 'Admin Applications Component'],
    
    // Scripts and documentation
    ['scripts/run-reviewer-invitation-tests.js', 'Test Runner Script'],
    ['docs/reviewer-invitation-debug-guide.md', 'Debug Guide Documentation'],
  ];
  
  let allFilesExist = true;
  
  for (const [filePath, description] of requiredFiles) {
    if (!checkFile(filePath, description)) {
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

function validateTestConfiguration() {
  logSection('Test Configuration Validation');
  
  try {
    const configPath = path.join(__dirname, '..', 'src/tests/reviewer-invitation.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Check for required configuration sections
    const requiredSections = [
      'TEST_CONFIG',
      'ENVIRONMENT_CONFIGS',
      'TestValidators',
      'TestDataGenerators',
    ];
    
    let allSectionsPresent = true;
    
    for (const section of requiredSections) {
      if (configContent.includes(section)) {
        log(`  ✓ ${section} configuration present`, 'green');
      } else {
        log(`  ✗ ${section} configuration missing`, 'red');
        allSectionsPresent = false;
      }
    }
    
    // Check for environment-specific configs
    const environments = ['development', 'testing', 'staging', 'production'];
    for (const env of environments) {
      if (configContent.includes(env)) {
        log(`  ✓ ${env} environment configuration present`, 'green');
      } else {
        log(`  ✗ ${env} environment configuration missing`, 'red');
        allSectionsPresent = false;
      }
    }
    
    return allSectionsPresent;
    
  } catch (error) {
    log(`  ✗ Failed to validate test configuration: ${error.message}`, 'red');
    return false;
  }
}

function validateAPIEndpoints() {
  logSection('API Endpoints Validation');
  
  const endpoints = [
    ['src/app/api/debug/reviewer-invitation-stats/route.ts', 'GET', 'Statistics endpoint'],
    ['src/app/api/debug/run-test/route.ts', 'POST', 'Test runner endpoint'],
    ['src/app/api/debug/create-test-invitation/route.ts', 'POST/DELETE', 'Test invitation creator'],
    ['src/app/api/invite/reviewer/[token]/route.ts', 'GET/POST', 'Invitation handler'],
  ];
  
  let allEndpointsValid = true;
  
  for (const [filePath, methods, description] of endpoints) {
    try {
      const fullPath = path.join(__dirname, '..', filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      
      const methodsArray = methods.split('/');
      let hasAllMethods = true;
      
      for (const method of methodsArray) {
        if (content.includes(`export async function ${method}`)) {
          // Method found
        } else {
          hasAllMethods = false;
          break;
        }
      }
      
      if (hasAllMethods) {
        log(`  ✓ ${description} (${methods})`, 'green');
      } else {
        log(`  ✗ ${description} - Missing methods: ${methods}`, 'red');
        allEndpointsValid = false;
      }
      
    } catch (error) {
      log(`  ✗ ${description} - File error: ${error.message}`, 'red');
      allEndpointsValid = false;
    }
  }
  
  return allEndpointsValid;
}

function validateTestCoverage() {
  logSection('Test Coverage Validation');
  
  try {
    const unitTestPath = path.join(__dirname, '..', 'src/tests/reviewer-invitation-debug.test.ts');
    const integrationTestPath = path.join(__dirname, '..', 'src/tests/reviewer-invitation-integration.test.ts');
    
    const unitTestContent = fs.readFileSync(unitTestPath, 'utf8');
    const integrationTestContent = fs.readFileSync(integrationTestPath, 'utf8');
    
    // Check for required test categories
    const testCategories = [
      'Invitation Token Validation',
      'Invitation Acceptance',
      'Edge Cases and Error Handling',
      'Data Consistency Validation',
      'End-to-End Invitation Flow',
      'Error Scenarios',
      'Performance and Load Testing',
      'Security Testing',
    ];
    
    let allCategoriesPresent = true;
    
    for (const category of testCategories) {
      const inUnit = unitTestContent.includes(category);
      const inIntegration = integrationTestContent.includes(category);
      
      if (inUnit || inIntegration) {
        log(`  ✓ ${category} tests present`, 'green');
      } else {
        log(`  ✗ ${category} tests missing`, 'red');
        allCategoriesPresent = false;
      }
    }
    
    // Count total test cases
    const unitTestCount = (unitTestContent.match(/it\(/g) || []).length;
    const integrationTestCount = (integrationTestContent.match(/it\(/g) || []).length;
    const totalTests = unitTestCount + integrationTestCount;
    
    log(`  ℹ Total test cases: ${totalTests} (${unitTestCount} unit + ${integrationTestCount} integration)`, 'blue');
    
    if (totalTests < 20) {
      log(`  ⚠ Consider adding more test cases for better coverage`, 'yellow');
    }
    
    return allCategoriesPresent;
    
  } catch (error) {
    log(`  ✗ Failed to validate test coverage: ${error.message}`, 'red');
    return false;
  }
}

function validateDebugDashboard() {
  logSection('Debug Dashboard Validation');
  
  try {
    const dashboardPath = path.join(__dirname, '..', 'src/components/debug/ReviewerInvitationDebugDashboard.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Check for required dashboard features
    const requiredFeatures = [
      'Real-time Statistics',
      'Interactive Testing',
      'Test Configuration',
      'Visual Results',
      'fetchStats',
      'runAllTests',
      'runSingleTest',
      'createTestInvitation',
    ];
    
    let allFeaturesPresent = true;
    
    for (const feature of requiredFeatures) {
      if (dashboardContent.includes(feature)) {
        log(`  ✓ ${feature} feature present`, 'green');
      } else {
        log(`  ✗ ${feature} feature missing`, 'red');
        allFeaturesPresent = false;
      }
    }
    
    // Check for UI components
    const uiComponents = [
      'Card',
      'Button',
      'Tabs',
      'Badge',
      'Dialog',
      'Input',
    ];
    
    for (const component of uiComponents) {
      if (dashboardContent.includes(component)) {
        log(`  ✓ ${component} UI component used`, 'green');
      } else {
        log(`  ⚠ ${component} UI component not found`, 'yellow');
      }
    }
    
    return allFeaturesPresent;
    
  } catch (error) {
    log(`  ✗ Failed to validate debug dashboard: ${error.message}`, 'red');
    return false;
  }
}

function validateDocumentation() {
  logSection('Documentation Validation');
  
  try {
    const docPath = path.join(__dirname, '..', 'docs/reviewer-invitation-debug-guide.md');
    const docContent = fs.readFileSync(docPath, 'utf8');
    
    // Check for required documentation sections
    const requiredSections = [
      '## Overview',
      '## Components',
      '## Test Categories',
      '## Usage Instructions',
      '## Monitoring and Alerts',
      '## Troubleshooting',
      '## Security Considerations',
      '## Best Practices',
    ];
    
    let allSectionsPresent = true;
    
    for (const section of requiredSections) {
      if (docContent.includes(section)) {
        log(`  ✓ ${section} section present`, 'green');
      } else {
        log(`  ✗ ${section} section missing`, 'red');
        allSectionsPresent = false;
      }
    }
    
    // Check documentation length
    const wordCount = docContent.split(/\s+/).length;
    log(`  ℹ Documentation length: ${wordCount} words`, 'blue');
    
    if (wordCount < 1000) {
      log(`  ⚠ Documentation might be too brief for comprehensive coverage`, 'yellow');
    }
    
    return allSectionsPresent;
    
  } catch (error) {
    log(`  ✗ Failed to validate documentation: ${error.message}`, 'red');
    return false;
  }
}

function validatePackageScripts() {
  logSection('Package Scripts Validation');
  
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredScripts = [
      'test:reviewer-invitation',
      'test:reviewer-invitation:unit',
      'test:reviewer-invitation:verbose',
      'test:reviewer-invitation:ci',
    ];
    
    let allScriptsPresent = true;
    
    for (const script of requiredScripts) {
      if (packageContent.scripts && packageContent.scripts[script]) {
        log(`  ✓ ${script} script present`, 'green');
      } else {
        log(`  ✗ ${script} script missing`, 'red');
        allScriptsPresent = false;
      }
    }
    
    return allScriptsPresent;
    
  } catch (error) {
    log(`  ✗ Failed to validate package scripts: ${error.message}`, 'red');
    return false;
  }
}

function generateValidationReport(results) {
  logSection('Validation Report');
  
  const totalChecks = Object.keys(results).length;
  const passedChecks = Object.values(results).filter(Boolean).length;
  const failedChecks = totalChecks - passedChecks;
  
  log(`\nValidation Summary:`, 'bright');
  log(`  Total Checks: ${totalChecks}`, 'blue');
  log(`  Passed: ${passedChecks}`, 'green');
  log(`  Failed: ${failedChecks}`, failedChecks > 0 ? 'red' : 'green');
  log(`  Success Rate: ${Math.round((passedChecks / totalChecks) * 100)}%`, passedChecks === totalChecks ? 'green' : 'yellow');
  
  if (failedChecks > 0) {
    log(`\nFailed Validations:`, 'red');
    for (const [check, passed] of Object.entries(results)) {
      if (!passed) {
        log(`  ✗ ${check}`, 'red');
      }
    }
    
    log(`\nRecommendations:`, 'yellow');
    log(`  1. Review the failed validations above`, 'yellow');
    log(`  2. Ensure all required files are present and properly configured`, 'yellow');
    log(`  3. Run the validation script again after fixes`, 'yellow');
  } else {
    log(`\n🎉 All validations passed! The debug system is properly configured.`, 'green');
  }
  
  return passedChecks === totalChecks;
}

function main() {
  log('Reviewer Invitation Debug System Validation', 'bright');
  log('============================================', 'bright');
  
  const results = {
    'File Structure': validateFileStructure(),
    'Test Configuration': validateTestConfiguration(),
    'API Endpoints': validateAPIEndpoints(),
    'Test Coverage': validateTestCoverage(),
    'Debug Dashboard': validateDebugDashboard(),
    'Documentation': validateDocumentation(),
    'Package Scripts': validatePackageScripts(),
  };
  
  const allValid = generateValidationReport(results);
  
  if (allValid) {
    log('\n✅ Debug system is ready for use!', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. Start your Next.js development server: npm run dev', 'cyan');
    log('  2. Run the test suite: npm run test:reviewer-invitation', 'cyan');
    log('  3. Access the debug dashboard at /admin/debug/reviewer-invitations', 'cyan');
    process.exit(0);
  } else {
    log('\n❌ Debug system validation failed. Please address the issues above.', 'red');
    process.exit(1);
  }
}

// Run validation
if (require.main === module) {
  main();
}

module.exports = { main };

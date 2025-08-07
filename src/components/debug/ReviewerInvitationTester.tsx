'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Copy,
  ExternalLink,
  RefreshCw,
  Database,
  Link as LinkIcon,
  User,
  Trash2
} from 'lucide-react';
import type { ReviewerInvitation } from '@/lib/types';

interface TestResult {
  step: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  timestamp: Date;
  details?: any;
}

export function ReviewerInvitationTester() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testEmail, setTestEmail] = useState('test@gmail.com');
  const [createdInvitation, setCreatedInvitation] = useState<any>(null);
  const [inviteToken, setInviteToken] = useState<string>('');
  const [manualToken, setManualToken] = useState<string>('');

  const addTestResult = (step: string, status: TestResult['status'], message: string, details?: any) => {
    const result: TestResult = {
      step,
      status,
      message,
      timestamp: new Date(),
      details
    };
    setTestResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
    setCreatedInvitation(null);
    setInviteToken('');
  };

  // Test 1: Environment Check
  const testEnvironment = async () => {
    addTestResult('Environment Check', 'pending', 'Checking environment variables and configuration...');
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      const hasFirebaseConfig = !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
      
      if (!hasFirebaseConfig) {
        addTestResult('Environment Check', 'warning', 'Firebase config may be missing from environment');
      } else {
        addTestResult('Environment Check', 'success', `Environment configured. Base URL: ${baseUrl}`);
      }
    } catch (error) {
      addTestResult('Environment Check', 'error', `Environment check failed: ${error}`);
    }
  };

  // Test 2: API Endpoint Availability
  const testAPIEndpoints = async () => {
    addTestResult('API Endpoints', 'pending', 'Testing API endpoint availability...');
    
    try {
      // Test GET endpoint
      const getResponse = await fetch('/api/admin/reviewer-invitations');
      if (getResponse.ok) {
        const data = await getResponse.json();
        addTestResult('API Endpoints', 'success', `GET endpoint working. Found ${data.invitations?.length || 0} existing invitations`);
      } else {
        addTestResult('API Endpoints', 'error', `GET endpoint failed: ${getResponse.status} ${getResponse.statusText}`);
      }
    } catch (error) {
      addTestResult('API Endpoints', 'error', `API endpoint test failed: ${error}`);
    }
  };

  // Test 3: Gmail Validation Tests
  const testGmailValidation = async () => {
    addTestResult('Gmail Validation', 'pending', 'Testing email domain validation...');
    
    const testCases = [
      { email: 'test@yahoo.com', shouldFail: true, description: 'Yahoo email (should fail)' },
      { email: 'user@outlook.com', shouldFail: true, description: 'Outlook email (should fail)' },
      { email: 'admin@company.com', shouldFail: true, description: 'Company email (should fail)' },
      { email: 'valid@gmail.com', shouldFail: false, description: 'Gmail email (should succeed)' },
      { email: 'CAPS@GMAIL.COM', shouldFail: false, description: 'Uppercase Gmail (should succeed)' },
      { email: 'test.user+tag@gmail.com', shouldFail: false, description: 'Gmail with plus addressing (should succeed)' }
    ];
    
    for (const testCase of testCases) {
      try {
        const response = await fetch('/api/admin/reviewer-invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: testCase.email }),
        });
        
        const data = await response.json();
        
        if (testCase.shouldFail) {
          if (!response.ok && data.error?.includes('Gmail address required')) {
            addTestResult('Gmail Validation', 'success', `✓ ${testCase.description}: Correctly rejected`);
          } else {
            addTestResult('Gmail Validation', 'error', `✗ ${testCase.description}: Should have been rejected but wasn't`);
          }
        } else {
          if (response.ok) {
            addTestResult('Gmail Validation', 'success', `✓ ${testCase.description}: Correctly accepted`);
            // Clean up - delete the test invitation
            // Note: We'd need a delete endpoint for proper cleanup
          } else {
            addTestResult('Gmail Validation', 'error', `✗ ${testCase.description}: Should have been accepted but was rejected: ${data.error}`);
          }
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        addTestResult('Gmail Validation', 'error', `Error testing ${testCase.description}: ${error}`);
      }
    }
  };

  // Test 4: Create Invitation
  const testCreateInvitation = async () => {
    addTestResult('Create Invitation', 'pending', `Creating invitation for ${testEmail}...`);
    
    try {
      const response = await fetch('/api/admin/reviewer-invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: testEmail }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setCreatedInvitation(data);
        
        // Extract token from invite link
        if (data.inviteLink) {
          const tokenMatch = data.inviteLink.match(/\/invite\/reviewer\/([^\/]+)$/);
          if (tokenMatch) {
            setInviteToken(tokenMatch[1]);
          }
        }
        
        addTestResult('Create Invitation', 'success', 'Invitation created successfully', {
          invitationId: data.invitationId,
          inviteLink: data.inviteLink
        });
      } else {
        const errorData = await response.json();
        addTestResult('Create Invitation', 'error', `Failed to create invitation: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTestResult('Create Invitation', 'error', `Create invitation failed: ${error}`);
    }
  };

  // Test 5: Validate Token
  const testValidateToken = async (token: string) => {
    addTestResult('Validate Token', 'pending', `Validating token: ${token.substring(0, 8)}...`);
    
    try {
      const response = await fetch(`/api/invite/reviewer/${token}`);
      
      if (response.ok) {
        const data = await response.json();
        addTestResult('Validate Token', 'success', 'Token validation successful', {
          invitation: data.invitation
        });
        return data.invitation;
      } else {
        const errorData = await response.json();
        addTestResult('Validate Token', 'error', `Token validation failed: ${errorData.error || response.statusText}`);
        return null;
      }
    } catch (error) {
      addTestResult('Validate Token', 'error', `Token validation error: ${error}`);
      return null;
    }
  };

  // Test 6: Database Verification
  const testDatabaseState = async () => {
    addTestResult('Database Check', 'pending', 'Checking database state...');
    
    try {
      const response = await fetch('/api/admin/reviewer-invitations');
      if (response.ok) {
        const data = await response.json();
        const invitations = data.invitations || [];
        
        const pending = invitations.filter((inv: ReviewerInvitation) => inv.status === 'pending').length;
        const accepted = invitations.filter((inv: ReviewerInvitation) => inv.status === 'accepted').length;
        const expired = invitations.filter((inv: ReviewerInvitation) => inv.status === 'expired').length;
        
        addTestResult('Database Check', 'success', `Database state: ${pending} pending, ${accepted} accepted, ${expired} expired`, {
          totalInvitations: invitations.length,
          breakdown: { pending, accepted, expired }
        });
      } else {
        addTestResult('Database Check', 'error', 'Failed to fetch database state');
      }
    } catch (error) {
      addTestResult('Database Check', 'error', `Database check failed: ${error}`);
    }
  };

  // Test 7: Invitation Landing Page
  const testLandingPage = async (token: string) => {
    addTestResult('Landing Page', 'pending', 'Testing invitation landing page...');
    
    try {
      const inviteUrl = `${window.location.origin}/invite/reviewer/${token}`;
      
      // We can't fully test the page without actually navigating, but we can check the URL structure
      const isValidUrl = token && token.length > 10;
      
      if (isValidUrl) {
        addTestResult('Landing Page', 'success', `Landing page URL generated: ${inviteUrl}`, {
          url: inviteUrl,
          token: token
        });
      } else {
        addTestResult('Landing Page', 'error', 'Invalid token for landing page');
      }
    } catch (error) {
      addTestResult('Landing Page', 'error', `Landing page test failed: ${error}`);
    }
  };

  // Test 8: Delete Invitation
  const testDeleteInvitation = async () => {
    addTestResult('Delete Invitation', 'pending', 'Testing invitation deletion...');
    
    try {
      // First, get current invitations to find one to delete
      const getResponse = await fetch('/api/admin/reviewer-invitations');
      if (!getResponse.ok) {
        addTestResult('Delete Invitation', 'error', 'Failed to fetch invitations for deletion test');
        return;
      }
      
      const data = await getResponse.json();
      const pendingInvitations = data.invitations?.filter((inv: any) => inv.status === 'pending') || [];
      
      if (pendingInvitations.length === 0) {
        addTestResult('Delete Invitation', 'warning', 'No pending invitations found to test deletion');
        return;
      }
      
      const invitationToDelete = pendingInvitations[0];
      
      // Test deletion
      const deleteResponse = await fetch(`/api/admin/reviewer-invitations?id=${invitationToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (deleteResponse.ok) {
        const deleteData = await deleteResponse.json();
        addTestResult('Delete Invitation', 'success', `Successfully deleted invitation for ${invitationToDelete.email}`, {
          deletedInvitation: deleteData.deletedInvitation
        });
      } else {
        const errorData = await deleteResponse.json();
        addTestResult('Delete Invitation', 'error', `Failed to delete invitation: ${errorData.error}`);
      }
      
    } catch (error) {
      addTestResult('Delete Invitation', 'error', `Delete invitation test failed: ${error}`);
    }
  };

  // Run Full Test Suite
  const runFullTestSuite = async () => {
    setIsRunning(true);
    clearResults();
    
    addTestResult('Test Suite', 'pending', 'Starting comprehensive reviewer invitation test suite...');
    
    // Run tests sequentially
    await testEnvironment();
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for readability
    
    await testAPIEndpoints();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testGmailValidation();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testCreateInvitation();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (inviteToken) {
      await testValidateToken(inviteToken);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testLandingPage(inviteToken);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    await testDatabaseState();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testDeleteInvitation();
    
    addTestResult('Test Suite', 'success', 'Test suite completed');
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'pending':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addTestResult('Clipboard', 'success', 'Copied to clipboard');
    } catch (error) {
      addTestResult('Clipboard', 'error', 'Failed to copy to clipboard');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Reviewer Invitation System Tester
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Configuration */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Test Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-token">Manual Token Test</Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-token"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Enter token to validate..."
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => manualToken && testValidateToken(manualToken)}
                    disabled={!manualToken || isRunning}
                  >
                    Test
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Test Controls */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={runFullTestSuite}
              disabled={isRunning}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Run Full Test Suite
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={clearResults} disabled={isRunning}>
              Clear Results
            </Button>
            
            <Button variant="outline" onClick={testDatabaseState} disabled={isRunning}>
              <Database className="mr-2 h-4 w-4" />
              Check Database
            </Button>
            
            <Button variant="outline" onClick={testGmailValidation} disabled={isRunning}>
              <Mail className="mr-2 h-4 w-4" />
              Test Gmail Validation
            </Button>
            
            <Button variant="outline" onClick={testDeleteInvitation} disabled={isRunning}>
              <Trash2 className="mr-2 h-4 w-4" />
              Test Delete Invitation
            </Button>
          </div>

          {/* Created Invitation Info */}
          {createdInvitation && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Created Invitation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">ID: {createdInvitation.invitationId}</Badge>
                  <Badge variant="secondary">Token: {inviteToken.substring(0, 8)}...</Badge>
                </div>
                {createdInvitation.inviteLink && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(createdInvitation.inviteLink)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(createdInvitation.inviteLink, '_blank')}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Test Results ({testResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{result.step}</h4>
                        <span className="text-xs text-muted-foreground">
                          {result.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                      {result.details && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

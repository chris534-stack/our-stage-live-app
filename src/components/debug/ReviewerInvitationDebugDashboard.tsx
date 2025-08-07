'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  Bug,
  Database,
  Mail,
  Shield,
  Zap,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface DebugTest {
  id: string;
  name: string;
  description: string;
  category: 'validation' | 'acceptance' | 'security' | 'performance' | 'integration';
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
  details?: any;
}

interface DebugStats {
  totalInvitations: number;
  pendingInvitations: number;
  acceptedInvitations: number;
  expiredInvitations: number;
  averageAcceptanceTime: number;
  errorRate: number;
}

export function ReviewerInvitationDebugDashboard() {
  const [tests, setTests] = useState<DebugTest[]>([]);
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testEmail, setTestEmail] = useState('debug@test.com');
  const [testToken, setTestToken] = useState('');
  const [realTimeMonitoring, setRealTimeMonitoring] = useState(false);
  const [showTestResults, setShowTestResults] = useState(false);
  const [selectedTestResult, setSelectedTestResult] = useState<DebugTest | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    initializeTests();
    fetchStats();
    
    // Set up Real-time Statistics monitoring if enabled
    let interval: NodeJS.Timeout;
    if (realTimeMonitoring) {
      interval = setInterval(() => {
        fetchStats();
        // Also refresh test results in real-time
        if (tests.some(test => test.status === 'running')) {
          // Keep monitoring running tests
        }
      }, 5000); // Update every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [realTimeMonitoring]);

  const initializeTests = () => {
    const debugTests: DebugTest[] = [
      // Validation Tests
      {
        id: 'validate-pending',
        name: 'Validate Pending Invitation',
        description: 'Test GET request with valid pending invitation token',
        category: 'validation',
        status: 'pending',
      },
      {
        id: 'validate-expired',
        name: 'Handle Expired Invitation',
        description: 'Test behavior with expired invitation token',
        category: 'validation',
        status: 'pending',
      },
      {
        id: 'validate-invalid',
        name: 'Handle Invalid Token',
        description: 'Test response to completely invalid token',
        category: 'validation',
        status: 'pending',
      },
      {
        id: 'validate-missing',
        name: 'Handle Missing Token',
        description: 'Test response when token parameter is missing',
        category: 'validation',
        status: 'pending',
      },

      // Acceptance Tests
      {
        id: 'accept-valid',
        name: 'Accept Valid Invitation',
        description: 'Test successful invitation acceptance flow',
        category: 'acceptance',
        status: 'pending',
      },
      {
        id: 'accept-mismatch',
        name: 'Reject Email Mismatch',
        description: 'Test rejection when Firebase email differs from invitation',
        category: 'acceptance',
        status: 'pending',
      },
      {
        id: 'accept-duplicate',
        name: 'Prevent Duplicate Acceptance',
        description: 'Test that already accepted invitations cannot be reused',
        category: 'acceptance',
        status: 'pending',
      },
      {
        id: 'accept-profile-update',
        name: 'Update Existing Profile',
        description: 'Test updating existing user profile with reviewer privileges',
        category: 'acceptance',
        status: 'pending',
      },

      // Security Tests
      {
        id: 'security-token-enum',
        name: 'Prevent Token Enumeration',
        description: 'Test that invalid tokens don\'t reveal system information',
        category: 'security',
        status: 'pending',
      },
      {
        id: 'security-firebase-validation',
        name: 'Validate Firebase Tokens',
        description: 'Test that invalid Firebase tokens are properly rejected',
        category: 'security',
        status: 'pending',
      },
      {
        id: 'security-injection',
        name: 'SQL/NoSQL Injection Protection',
        description: 'Test protection against injection attacks',
        category: 'security',
        status: 'pending',
      },

      // Performance Tests
      {
        id: 'perf-response-time',
        name: 'Response Time Validation',
        description: 'Test that API responses are within acceptable time limits',
        category: 'performance',
        status: 'pending',
      },
      {
        id: 'perf-concurrent',
        name: 'Concurrent Request Handling',
        description: 'Test handling of multiple simultaneous requests',
        category: 'performance',
        status: 'pending',
      },

      // Integration Tests
      {
        id: 'integration-e2e',
        name: 'End-to-End Flow',
        description: 'Test complete invitation lifecycle from creation to acceptance',
        category: 'integration',
        status: 'pending',
      },
      {
        id: 'integration-database',
        name: 'Database Consistency',
        description: 'Test that database state remains consistent across operations',
        category: 'integration',
        status: 'pending',
      },
    ];

    setTests(debugTests);
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/debug/reviewer-invitation-stats');
      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    
    try {
      for (const test of tests) {
        await runSingleTest(test.id);
        // Small delay between tests to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      toast({
        title: 'Tests Completed',
        description: 'All debug tests have been executed.',
      });
    } catch (error) {
      toast({
        title: 'Test Execution Failed',
        description: 'Some tests could not be completed.',
        variant: 'destructive',
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  // Interactive Testing - Enhanced single test runner with Visual Results
  const runSingleTest = async (testId: string) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { ...test, status: 'running' as const }
        : test
    ));

    const startTime = Date.now();

    try {
      const response = await fetch('/api/debug/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, testEmail, testToken }),
      });

      const result = await response.json();
      const duration = Date.now() - startTime;

      const updatedTest = {
        status: result.success ? 'passed' as const : 'failed' as const,
        duration,
        error: result.error,
        details: result.details,
      };

      setTests(prev => prev.map(test => 
        test.id === testId 
          ? { ...test, ...updatedTest }
          : test
      ));

      // Show Visual Results for Interactive Testing
      toast({
        title: result.success ? 'Test Passed' : 'Test Failed',
        description: `${testId} completed in ${duration}ms`,
        variant: result.success ? 'default' : 'destructive',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      setTests(prev => prev.map(test => 
        test.id === testId 
          ? { 
              ...test, 
              status: 'failed' as const,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          : test
      ));

      toast({
        title: 'Test Error',
        description: `${testId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const createTestInvitation = async () => {
    try {
      const response = await fetch('/api/debug/create-test-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTestToken(result.token);
        toast({
          title: 'Test Invitation Created',
          description: `Token: ${result.token.substring(0, 16)}...`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Failed to Create Test Invitation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: DebugTest['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCategoryIcon = (category: DebugTest['category']) => {
    switch (category) {
      case 'validation': return <CheckCircle className="h-4 w-4" />;
      case 'acceptance': return <Mail className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
      case 'integration': return <Database className="h-4 w-4" />;
    }
  };

  const getTestsByCategory = (category: DebugTest['category']) => {
    return tests.filter(test => test.category === category);
  };

  const getOverallStatus = () => {
    const passed = tests.filter(test => test.status === 'passed').length;
    const failed = tests.filter(test => test.status === 'failed').length;
    const total = tests.length;
    
    if (failed > 0) return 'failed';
    if (passed === total) return 'passed';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reviewer Invitation Debug Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive testing and monitoring for the reviewer invitation pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setRealTimeMonitoring(!realTimeMonitoring)}
            variant={realTimeMonitoring ? 'default' : 'outline'}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${realTimeMonitoring ? 'animate-spin' : ''}`} />
            Real-time Monitoring
          </Button>
          <Button onClick={runAllTests} disabled={isRunningTests}>
            <Play className="h-4 w-4 mr-2" />
            {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invitations</p>
                  <p className="text-2xl font-bold">{stats.totalInvitations}</p>
                </div>
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                  <p className="text-2xl font-bold">
                    {stats.totalInvitations > 0 
                      ? Math.round((stats.acceptedInvitations / stats.totalInvitations) * 100)
                      : 0}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Accept Time</p>
                  <p className="text-2xl font-bold">{stats.averageAcceptanceTime}h</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                  <p className="text-2xl font-bold">{stats.errorRate.toFixed(1)}%</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Test Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Test Email</Label>
              <Input
                id="test-email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="debug@test.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-token">Test Token</Label>
              <div className="flex gap-2">
                <Input
                  id="test-token"
                  value={testToken}
                  onChange={(e) => setTestToken(e.target.value)}
                  placeholder="Generated token will appear here"
                  readOnly
                />
                <Button onClick={createTestInvitation} size="sm">
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All Tests</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="acceptance">Acceptance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4">
            {tests.map((test) => (
              <Card key={test.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(test.status)}
                      {getCategoryIcon(test.category)}
                      <div>
                        <h4 className="font-semibold">{test.name}</h4>
                        <p className="text-sm text-muted-foreground">{test.description}</p>
                        {test.error && (
                          <p className="text-sm text-red-600 mt-1">{test.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {test.duration && (
                        <Badge variant="outline">{test.duration}ms</Badge>
                      )}
                      <Badge variant="outline">{test.category}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runSingleTest(test.id)}
                        disabled={test.status === 'running'}
                      >
                        Run
                      </Button>
                      {(test.details || test.error) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedTestResult(test);
                            setShowTestResults(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {(['validation', 'acceptance', 'security', 'performance', 'integration'] as const).map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid gap-4">
              {getTestsByCategory(category).map((test) => (
                <Card key={test.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(test.status)}
                        <div>
                          <h4 className="font-semibold">{test.name}</h4>
                          <p className="text-sm text-muted-foreground">{test.description}</p>
                          {test.error && (
                            <p className="text-sm text-red-600 mt-1">{test.error}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {test.duration && (
                          <Badge variant="outline">{test.duration}ms</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runSingleTest(test.id)}
                          disabled={test.status === 'running'}
                        >
                          Run
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Overall Status */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Overall Pipeline Status: <Badge variant={getOverallStatus() === 'passed' ? 'default' : 'destructive'}>
            {getOverallStatus().toUpperCase()}
          </Badge>
          {getOverallStatus() === 'failed' && (
            <span className="ml-2">Some tests are failing. Review the results above.</span>
          )}
        </AlertDescription>
      </Alert>

      {/* Visual Results Dialog for Interactive Testing */}
      <Dialog open={showTestResults} onOpenChange={setShowTestResults}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Results: {selectedTestResult?.name}</DialogTitle>
            <DialogDescription>
              Detailed results and debugging information for the selected test
            </DialogDescription>
          </DialogHeader>
          
          {selectedTestResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(selectedTestResult.status)}
                    <Badge variant={selectedTestResult.status === 'passed' ? 'default' : 'destructive'}>
                      {selectedTestResult.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Duration</Label>
                  <p className="text-sm mt-1">{selectedTestResult.duration}ms</p>
                </div>
              </div>
              
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTestResult.description}
                </p>
              </div>
              
              {selectedTestResult.error && (
                <div>
                  <Label className="text-red-600">Error</Label>
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-1">
                    <code className="text-sm text-red-800">{selectedTestResult.error}</code>
                  </div>
                </div>
              )}
              
              {selectedTestResult.details && (
                <div>
                  <Label>Details</Label>
                  <div className="bg-gray-50 border rounded-md p-3 mt-1">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(selectedTestResult.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

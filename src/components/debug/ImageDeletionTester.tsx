'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { deleteProfilePhotoAction } from '@/lib/actions';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
  details?: any;
}

export function ImageDeletionTester() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testUrl, setTestUrl] = useState('');

  const addTestResult = (step: string, status: TestResult['status'], message: string, details?: any) => {
    const result: TestResult = {
      step,
      status,
      message,
      timestamp: new Date(),
      details
    };
    setTestResults(prev => [...prev, result]);
    console.log(`[ImageDeletionTester] ${step}: ${message}`, details);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const analyzeUrl = (url: string) => {
    addTestResult('URL Analysis', 'pending', 'Analyzing Firebase Storage URL...');
    
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const filePath = pathParts.slice(2).join('/'); // Current logic
      
      const analysis = {
        originalUrl: url,
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        pathParts: pathParts,
        extractedFilePath: filePath,
        expectedFormat: 'Expected format: https://storage.googleapis.com/bucket-name/userId/filename',
        currentLogic: 'pathParts.slice(2).join("/")',
        wouldPassSecurityCheck: filePath.startsWith('test-user-id/')
      };
      
      addTestResult('URL Analysis', 'success', 'URL analyzed successfully', analysis);
      return analysis;
    } catch (error) {
      addTestResult('URL Analysis', 'error', 'Failed to parse URL', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  };

  const testDeletion = async (url: string) => {
    addTestResult('Deletion Test', 'pending', 'Testing image deletion...');
    
    try {
      const result = await deleteProfilePhotoAction('test-user-id', url);
      
      if (result.success) {
        addTestResult('Deletion Test', 'success', 'Deletion completed successfully!', result);
      } else {
        addTestResult('Deletion Test', 'error', `Deletion failed: ${result.message}`, result);
      }
    } catch (error) {
      addTestResult('Deletion Test', 'error', 'Deletion threw an exception', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  const runFullTest = async () => {
    if (!testUrl.trim()) {
      addTestResult('Test Suite', 'error', 'No URL provided for testing');
      return;
    }

    setIsRunning(true);
    clearResults();

    try {
      // Step 1: URL Analysis
      const analysis = analyzeUrl(testUrl);
      if (!analysis) {
        setIsRunning(false);
        return;
      }
      
      // Step 2: Deletion test
      await testDeletion(testUrl);
      
      addTestResult('Test Suite', 'success', 'All tests completed');
    } catch (error) {
      addTestResult('Test Suite', 'error', 'Test suite failed', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Image Deletion Testing Tool
          </CardTitle>
          <CardDescription>
            Admin-only debugging tool for testing image deletion functionality and URL path extraction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Firebase Storage URL to Test</label>
            <input
              type="url"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://storage.googleapis.com/bucket-name/userId/filename.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              Paste a Firebase Storage URL from your gallery to test the deletion logic
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={runFullTest} 
              disabled={!testUrl.trim() || isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Test Deletion Logic
            </Button>
            <Button variant="outline" onClick={clearResults}>
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Detailed analysis of the image deletion process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {result.step}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {result.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-600 cursor-pointer">
                            View Details
                          </summary>
                          <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
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

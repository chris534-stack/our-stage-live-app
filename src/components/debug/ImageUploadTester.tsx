'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { uploadProfilePhotoAction } from '@/lib/actions';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
  details?: any;
}

export function ImageUploadTester() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addTestResult = (step: string, status: TestResult['status'], message: string, details?: any) => {
    const result: TestResult = {
      step,
      status,
      message,
      timestamp: new Date(),
      details
    };
    setTestResults(prev => [...prev, result]);
    console.log(`[ImageUploadTester] ${step}: ${message}`, details);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const validateEnvironment = async () => {
    addTestResult('Environment Check', 'pending', 'Checking environment variables...');
    
    try {
      // Check if required environment variables are accessible
      const response = await fetch('/api/debug/env-check');
      if (response.ok) {
        const envData = await response.json();
        addTestResult('Environment Check', 'success', 'Environment variables validated', envData);
      } else {
        addTestResult('Environment Check', 'error', 'Failed to validate environment variables');
      }
    } catch (error) {
      addTestResult('Environment Check', 'error', 'Environment check failed', error);
    }
  };

  const validateFile = (file: File) => {
    addTestResult('File Validation', 'pending', 'Validating selected file...');
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      addTestResult('File Validation', 'error', `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`);
      return false;
    }
    
    if (file.size > maxSize) {
      addTestResult('File Validation', 'error', `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 10MB`);
      return false;
    }
    
    addTestResult('File Validation', 'success', `File validated: ${file.name} (${(file.size / 1024).toFixed(2)}KB, ${file.type})`);
    return true;
  };

  const testUpload = async (file: File) => {
    addTestResult('Upload Test', 'pending', 'Starting upload test...');
    
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('userId', 'test-user-id'); // Using test user ID
      
      const result = await uploadProfilePhotoAction(formData);
      
      if (result.success) {
        addTestResult('Upload Test', 'success', 'Upload completed successfully!', result);
      } else {
        addTestResult('Upload Test', 'error', `Upload failed: ${result.message}`, result);
      }
    } catch (error) {
      addTestResult('Upload Test', 'error', 'Upload threw an exception', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  const runFullTest = async () => {
    if (!selectedFile) {
      addTestResult('Test Suite', 'error', 'No file selected for testing');
      return;
    }

    setIsRunning(true);
    clearResults();

    try {
      // Step 1: Environment validation
      await validateEnvironment();
      
      // Step 2: File validation
      if (!validateFile(selectedFile)) {
        setIsRunning(false);
        return;
      }
      
      // Step 3: Upload test
      await testUpload(selectedFile);
      
      addTestResult('Test Suite', 'success', 'All tests completed');
    } catch (error) {
      addTestResult('Test Suite', 'error', 'Test suite failed', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
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
            <Upload className="h-5 w-5" />
            Image Upload Testing Tool
          </CardTitle>
          <CardDescription>
            Admin-only comprehensive testing tool for debugging image upload functionality.
            This tool uses the same upload pipeline as the profile page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Test Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFile && (
              <div className="text-sm text-gray-600">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)}KB)
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={runFullTest} 
              disabled={!selectedFile || isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Run Full Test
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
              Detailed results from the image upload testing process
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
                          <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
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

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Admin Development Tool:</strong> This testing interface is for admin debugging purposes. 
          It uses the same upload pipeline as the profile page but with a test user ID to avoid affecting real user data.
        </AlertDescription>
      </Alert>
    </div>
  );
}

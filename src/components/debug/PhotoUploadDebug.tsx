'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Upload,
  Image,
  Bug,
  TestTube,
  Database,
  Link
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadProfilePhotoAction, uploadMultiplePhotosAction } from '@/lib/actions';

interface PhotoDebugResult {
  url: string;
  status: 'loading' | 'success' | 'error';
  statusCode?: number;
  error?: string;
  responseTime?: number;
  headers?: Record<string, string>;
}

interface UploadTestResult {
  success: boolean;
  message?: string;
  duration: number;
  fileSize: number;
  fileName: string;
  error?: string;
}

export function PhotoUploadDebug() {
  const [testUrls, setTestUrls] = useState('');
  const [urlResults, setUrlResults] = useState<PhotoDebugResult[]>([]);
  const [urlTesting, setUrlTesting] = useState(false);
  
  const [uploadResults, setUploadResults] = useState<UploadTestResult[]>([]);
  const [uploadTesting, setUploadTesting] = useState(false);
  const [testUserId, setTestUserId] = useState('test-user-debug');
  
  const { toast } = useToast();

  // Test photo URL accessibility
  const testPhotoUrls = async () => {
    const urls = testUrls.split('\n').filter(url => url.trim());
    if (urls.length === 0) return;

    setUrlTesting(true);
    setUrlResults(urls.map(url => ({ url: url.trim(), status: 'loading' })));

    const testPromises = urls.map(async (url) => {
      const startTime = Date.now();
      try {
        const response = await fetch(url.trim(), { 
          method: 'HEAD',
          mode: 'cors'
        });
        const responseTime = Date.now() - startTime;
        
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        return {
          url: url.trim(),
          status: response.ok ? 'success' as const : 'error' as const,
          statusCode: response.status,
          responseTime,
          headers,
          error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        return {
          url: url.trim(),
          status: 'error' as const,
          responseTime,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    const testResults = await Promise.all(testPromises);
    setUrlResults(testResults);
    setUrlTesting(false);
  };

  // Test single photo upload (original PhotoUploader)
  const testSingleUpload = async (file: File) => {
    const startTime = Date.now();
    
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('userId', testUserId);

      const result = await uploadProfilePhotoAction(formData);
      const duration = Date.now() - startTime;

      return {
        success: result.success,
        message: result.message,
        duration,
        fileSize: file.size,
        fileName: file.name,
        error: result.success ? undefined : result.message
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        duration,
        fileSize: file.size,
        fileName: file.name,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Test multi photo upload
  const testMultiUpload = async (files: File[]) => {
    const startTime = Date.now();
    
    try {
      const formData = new FormData();
      formData.append('userId', testUserId);
      
      files.forEach(file => {
        formData.append('photos', file);
      });

      const result = await uploadMultiplePhotosAction(formData);
      const duration = Date.now() - startTime;

      return {
        success: result.success,
        message: result.message,
        duration,
        fileSize: files.reduce((total, file) => total + file.size, 0),
        fileName: `${files.length} files`,
        error: result.success ? undefined : result.message
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        duration,
        fileSize: files.reduce((total, file) => total + file.size, 0),
        fileName: `${files.length} files`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Handle file upload testing
  const handleUploadTest = async (event: React.ChangeEvent<HTMLInputElement>, isMulti: boolean = false) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadTesting(true);
    
    try {
      let result: UploadTestResult;
      
      if (isMulti) {
        result = await testMultiUpload(files);
      } else {
        result = await testSingleUpload(files[0]);
      }
      
      setUploadResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
      
      toast({
        title: result.success ? 'Upload Test Successful' : 'Upload Test Failed',
        description: result.message || result.error,
        variant: result.success ? 'default' : 'destructive'
      });
    } catch (error) {
      toast({
        title: 'Upload Test Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setUploadTesting(false);
      // Reset input
      event.target.value = '';
    }
  };

  const getStatusIcon = (status: PhotoDebugResult['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: PhotoDebugResult['status']) => {
    switch (status) {
      case 'loading':
        return 'bg-blue-100 text-blue-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Photo Upload Debug Tools
        </h3>
        <p className="text-muted-foreground">
          Debug photo upload issues, test URL accessibility, and diagnose client-side crashes.
        </p>
      </div>

      <Tabs defaultValue="url-test" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="url-test" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            URL Testing
          </TabsTrigger>
          <TabsTrigger value="upload-test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Upload Testing
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url-test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Photo URL Accessibility Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="urls">Photo URLs to Test (one per line)</Label>
                <Textarea
                  id="urls"
                  placeholder="https://storage.googleapis.com/...
https://firebasestorage.googleapis.com/..."
                  value={testUrls}
                  onChange={(e) => setTestUrls(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              
              <Button 
                onClick={testPhotoUrls} 
                disabled={urlTesting || !testUrls.trim()}
              >
                {urlTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing URLs...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Test Photo URLs
                  </>
                )}
              </Button>

              {urlResults.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h4 className="font-medium">Test Results</h4>
                  {urlResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(result.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getStatusColor(result.status)}>
                              {result.status}
                            </Badge>
                            {result.statusCode && (
                              <Badge variant="outline">
                                {result.statusCode}
                              </Badge>
                            )}
                            {result.responseTime && (
                              <Badge variant="outline">
                                {result.responseTime}ms
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm font-mono break-all text-muted-foreground mb-2">
                            {result.url}
                          </div>
                          
                          {result.error && (
                            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                              <strong>Error:</strong> {result.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload-test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Photo Upload Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="test-user-id">Test User ID</Label>
                <Input
                  id="test-user-id"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="test-user-debug"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Test Single Photo Upload (Original)</Label>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadTest(e, false)}
                      disabled={uploadTesting}
                    />
                  </div>
                </div>

                <div>
                  <Label>Test Multi Photo Upload (New)</Label>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleUploadTest(e, true)}
                      disabled={uploadTesting}
                    />
                  </div>
                </div>
              </div>

              {uploadTesting && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Testing upload... This may take a moment for large files.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Upload Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {uploadResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No upload tests performed yet. Use the Upload Testing tab to run tests.
                </p>
              ) : (
                <div className="space-y-3">
                  {uploadResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {result.success ? 'Success' : 'Failed'}
                            </Badge>
                            <Badge variant="outline">
                              {result.duration}ms
                            </Badge>
                            <Badge variant="outline">
                              {(result.fileSize / 1024 / 1024).toFixed(2)}MB
                            </Badge>
                          </div>
                          
                          <div className="text-sm">
                            <strong>File:</strong> {result.fileName}
                          </div>
                          
                          {result.message && (
                            <div className="text-sm text-muted-foreground mt-1">
                              <strong>Message:</strong> {result.message}
                            </div>
                          )}
                          
                          {result.error && (
                            <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2">
                              <strong>Error:</strong> {result.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Known Issues:</strong> Moura reported client-side crashes with single photo uploads. 
              Test both upload methods to compare behavior and identify crash patterns.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}

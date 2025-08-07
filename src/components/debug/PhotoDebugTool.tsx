'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface PhotoDebugResult {
  url: string;
  status: 'loading' | 'success' | 'error';
  statusCode?: number;
  error?: string;
  responseTime?: number;
  headers?: Record<string, string>;
}

export function PhotoDebugTool() {
  const [testUrls, setTestUrls] = useState('');
  const [results, setResults] = useState<PhotoDebugResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const testPhotoUrls = async () => {
    const urls = testUrls.split('\n').filter(url => url.trim());
    if (urls.length === 0) return;

    setIsRunning(true);
    setResults(urls.map(url => ({ url: url.trim(), status: 'loading' })));

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
    setResults(testResults);
    setIsRunning(false);
  };

  const checkFirebasePermissions = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/debug/firebase-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: testUrls.split('\n').filter(url => url.trim()) })
      });
      
      const data = await response.json();
      console.log('Firebase permissions check:', data);
      
      // Update results with permission info
      setResults(prev => prev.map(result => ({
        ...result,
        permissionCheck: data.results?.find((r: any) => r.url === result.url)
      })));
    } catch (error) {
      console.error('Permission check failed:', error);
    }
    setIsRunning(false);
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Photo Debug Tool
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
          
          <div className="flex gap-2">
            <Button 
              onClick={testPhotoUrls} 
              disabled={isRunning || !testUrls.trim()}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Photo URLs'
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={checkFirebasePermissions} 
              disabled={isRunning || !testUrls.trim()}
            >
              Check Firebase Permissions
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
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
                      
                      {result.headers && Object.keys(result.headers).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-sm font-medium cursor-pointer">
                            Response Headers
                          </summary>
                          <div className="mt-2 text-xs font-mono bg-gray-50 p-2 rounded">
                            {Object.entries(result.headers).map(([key, value]) => (
                              <div key={key}>
                                <strong>{key}:</strong> {value}
                              </div>
                            ))}
                          </div>
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

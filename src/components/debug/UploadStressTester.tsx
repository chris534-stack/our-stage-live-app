'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, 
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Activity,
  Timer,
  FileX,
  Wifi,
  Database
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadProfilePhotoAction, uploadMultiplePhotosAction } from '@/lib/actions';

interface StressTestResult {
  testId: string;
  testType: 'single' | 'multi' | 'concurrent' | 'large-file' | 'network-stress';
  fileName: string;
  fileSize: number;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: number;
  networkCondition?: string;
  memoryUsage?: number;
}

interface NetworkCondition {
  name: string;
  description: string;
  delay: number; // ms
  dropRate: number; // 0-1
}

const NETWORK_CONDITIONS: NetworkCondition[] = [
  { name: 'Perfect', description: 'No delays or drops', delay: 0, dropRate: 0 },
  { name: 'Good WiFi', description: 'Slight delays', delay: 50, dropRate: 0.01 },
  { name: 'Poor WiFi', description: 'High delays, occasional drops', delay: 200, dropRate: 0.05 },
  { name: 'Mobile 3G', description: 'Very high delays, frequent drops', delay: 500, dropRate: 0.1 },
  { name: 'Unstable', description: 'Random delays and drops', delay: 1000, dropRate: 0.2 }
];

export function UploadStressTester() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [testResults, setTestResults] = useState<StressTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState('');
  const [progress, setProgress] = useState(0);
  const [networkCondition, setNetworkCondition] = useState<NetworkCondition>(NETWORK_CONDITIONS[0]);
  const [concurrentUploads, setConcurrentUploads] = useState(5);
  const [testIterations, setTestIterations] = useState(10);
  const [testUserId] = useState('stress-test-user');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Simulate network conditions
  const simulateNetworkDelay = (condition: NetworkCondition): Promise<void> => {
    return new Promise((resolve, reject) => {
      const shouldDrop = Math.random() < condition.dropRate;
      if (shouldDrop) {
        reject(new Error('Simulated network drop'));
        return;
      }
      
      const actualDelay = condition.delay + (Math.random() * condition.delay * 0.5);
      setTimeout(resolve, actualDelay);
    });
  };

  // Memory usage tracking
  const getMemoryUsage = (): number => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  };

  // Single upload stress test (Moura's issue)
  const runSingleUploadStressTest = async () => {
    if (selectedFiles.length === 0) return;
    
    const results: StressTestResult[] = [];
    setCurrentTest('Single Upload Stress Test');
    
    for (let i = 0; i < testIterations; i++) {
      const file = selectedFiles[Math.floor(Math.random() * selectedFiles.length)];
      const testId = `single-${Date.now()}-${i}`;
      const startTime = Date.now();
      const startMemory = getMemoryUsage();
      
      try {
        // Simulate network conditions
        await simulateNetworkDelay(networkCondition);
        
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('userId', testUserId);
        
        const result = await uploadProfilePhotoAction(formData);
        const duration = Date.now() - startTime;
        const endMemory = getMemoryUsage();
        
        results.push({
          testId,
          testType: 'single',
          fileName: file.name,
          fileSize: file.size,
          duration,
          success: result.success,
          error: result.success ? undefined : result.message,
          timestamp: Date.now(),
          networkCondition: networkCondition.name,
          memoryUsage: endMemory - startMemory
        });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          testId,
          testType: 'single',
          fileName: file.name,
          fileSize: file.size,
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          networkCondition: networkCondition.name
        });
      }
      
      setProgress(((i + 1) / testIterations) * 100);
      
      // Small delay between tests to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  };

  // Multi upload stress test
  const runMultiUploadStressTest = async () => {
    if (selectedFiles.length === 0) return;
    
    const results: StressTestResult[] = [];
    setCurrentTest('Multi Upload Stress Test');
    
    for (let i = 0; i < testIterations; i++) {
      const filesToUpload = selectedFiles.slice(0, Math.min(3, selectedFiles.length));
      const testId = `multi-${Date.now()}-${i}`;
      const startTime = Date.now();
      const startMemory = getMemoryUsage();
      
      try {
        await simulateNetworkDelay(networkCondition);
        
        const formData = new FormData();
        formData.append('userId', testUserId);
        filesToUpload.forEach(file => formData.append('photos', file));
        
        const result = await uploadMultiplePhotosAction(formData);
        const duration = Date.now() - startTime;
        const endMemory = getMemoryUsage();
        
        results.push({
          testId,
          testType: 'multi',
          fileName: `${filesToUpload.length} files`,
          fileSize: filesToUpload.reduce((total, file) => total + file.size, 0),
          duration,
          success: result.success,
          error: result.success ? undefined : result.message,
          timestamp: Date.now(),
          networkCondition: networkCondition.name,
          memoryUsage: endMemory - startMemory
        });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          testId,
          testType: 'multi',
          fileName: `${filesToUpload.length} files`,
          fileSize: filesToUpload.reduce((total, file) => total + file.size, 0),
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          networkCondition: networkCondition.name
        });
      }
      
      setProgress(((i + 1) / testIterations) * 100);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return results;
  };

  // Concurrent upload stress test
  const runConcurrentUploadStressTest = async () => {
    if (selectedFiles.length === 0) return;
    
    const results: StressTestResult[] = [];
    setCurrentTest('Concurrent Upload Stress Test');
    
    const concurrentPromises = Array.from({ length: concurrentUploads }, async (_, i) => {
      const file = selectedFiles[Math.floor(Math.random() * selectedFiles.length)];
      const testId = `concurrent-${Date.now()}-${i}`;
      const startTime = Date.now();
      
      try {
        await simulateNetworkDelay(networkCondition);
        
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('userId', testUserId);
        
        const result = await uploadProfilePhotoAction(formData);
        const duration = Date.now() - startTime;
        
        return {
          testId,
          testType: 'concurrent' as const,
          fileName: file.name,
          fileSize: file.size,
          duration,
          success: result.success,
          error: result.success ? undefined : result.message,
          timestamp: Date.now(),
          networkCondition: networkCondition.name
        };
        
      } catch (error) {
        const duration = Date.now() - startTime;
        return {
          testId,
          testType: 'concurrent' as const,
          fileName: file.name,
          fileSize: file.size,
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          networkCondition: networkCondition.name
        };
      }
    });
    
    const concurrentResults = await Promise.allSettled(concurrentPromises);
    concurrentResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          testId: `concurrent-${Date.now()}-${index}`,
          testType: 'concurrent',
          fileName: 'unknown',
          fileSize: 0,
          duration: 0,
          success: false,
          error: result.reason?.message || 'Promise rejected',
          timestamp: Date.now(),
          networkCondition: networkCondition.name
        });
      }
      setProgress(((index + 1) / concurrentUploads) * 100);
    });
    
    return results;
  };

  // Large file stress test (Zoë's corruption issue)
  const runLargeFileStressTest = async () => {
    if (selectedFiles.length === 0) return;
    
    const results: StressTestResult[] = [];
    setCurrentTest('Large File Stress Test');
    
    // Focus on larger files (>2MB) that are more prone to corruption
    const largeFiles = selectedFiles.filter(file => file.size > 2 * 1024 * 1024);
    const testFiles = largeFiles.length > 0 ? largeFiles : selectedFiles;
    
    for (let i = 0; i < Math.min(testIterations, 5); i++) {
      const file = testFiles[Math.floor(Math.random() * testFiles.length)];
      const testId = `large-file-${Date.now()}-${i}`;
      const startTime = Date.now();
      const startMemory = getMemoryUsage();
      
      try {
        // Add extra network stress for large files
        await simulateNetworkDelay({
          ...networkCondition,
          delay: networkCondition.delay * 2,
          dropRate: networkCondition.dropRate * 1.5
        });
        
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('userId', testUserId);
        
        // Test with diagnostic API to check file integrity
        const response = await fetch('/api/debug/test-upload', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        const duration = Date.now() - startTime;
        const endMemory = getMemoryUsage();
        
        results.push({
          testId,
          testType: 'large-file',
          fileName: file.name,
          fileSize: file.size,
          duration,
          success: result.success,
          error: result.success ? undefined : result.error,
          timestamp: Date.now(),
          networkCondition: networkCondition.name,
          memoryUsage: endMemory - startMemory
        });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          testId,
          testType: 'large-file',
          fileName: file.name,
          fileSize: file.size,
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          networkCondition: networkCondition.name
        });
      }
      
      setProgress(((i + 1) / Math.min(testIterations, 5)) * 100);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  };

  // Memory pressure test (Moura's crash issue)
  const runMemoryPressureTest = async () => {
    if (selectedFiles.length === 0) return;
    
    const results: StressTestResult[] = [];
    setCurrentTest('Memory Pressure Test');
    
    // Create multiple large FormData objects to stress memory
    const memoryStressFiles: File[] = [];
    for (let i = 0; i < 10; i++) {
      const file = selectedFiles[Math.floor(Math.random() * selectedFiles.length)];
      memoryStressFiles.push(file);
    }
    
    for (let i = 0; i < 3; i++) {
      const testId = `memory-pressure-${Date.now()}-${i}`;
      const startTime = Date.now();
      const startMemory = getMemoryUsage();
      
      try {
        // Create multiple FormData objects simultaneously
        const formDataArray = memoryStressFiles.map(file => {
          const formData = new FormData();
          formData.append('photo', file);
          formData.append('userId', testUserId);
          return formData;
        });
        
        // Try to upload one while keeping others in memory
        const result = await uploadProfilePhotoAction(formDataArray[0]);
        const duration = Date.now() - startTime;
        const endMemory = getMemoryUsage();
        
        results.push({
          testId,
          testType: 'large-file',
          fileName: `Memory stress test ${i + 1}`,
          fileSize: memoryStressFiles.reduce((sum, f) => sum + f.size, 0),
          duration,
          success: result.success,
          error: result.success ? undefined : result.message,
          timestamp: Date.now(),
          networkCondition: networkCondition.name,
          memoryUsage: endMemory - startMemory
        });
        
        // Force garbage collection if available
        if ('gc' in window) {
          (window as any).gc();
        }
        
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          testId,
          testType: 'large-file',
          fileName: `Memory stress test ${i + 1}`,
          fileSize: memoryStressFiles.reduce((sum, f) => sum + f.size, 0),
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          networkCondition: networkCondition.name
        });
      }
      
      setProgress(((i + 1) / 3) * 100);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  };

  // Run comprehensive stress test
  const runStressTest = async (testType: 'single' | 'multi' | 'concurrent' | 'large-file' | 'memory-pressure') => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select files to test with.',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    setProgress(0);
    
    try {
      let results: StressTestResult[] = [];
      
      switch (testType) {
        case 'single':
          results = await runSingleUploadStressTest() || [];
          break;
        case 'multi':
          results = await runMultiUploadStressTest() || [];
          break;
        case 'concurrent':
          results = await runConcurrentUploadStressTest() || [];
          break;
        case 'large-file':
          results = await runLargeFileStressTest() || [];
          break;
        case 'memory-pressure':
          results = await runMemoryPressureTest() || [];
          break;
      }
      
      setTestResults(prev => [...results, ...prev]);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      toast({
        title: 'Stress Test Complete',
        description: `${successCount} succeeded, ${failureCount} failed`,
        variant: failureCount > 0 ? 'destructive' : 'default'
      });
      
    } catch (error) {
      toast({
        title: 'Stress Test Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
      setProgress(0);
      setCurrentTest('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getResultStats = () => {
    if (testResults.length === 0) return null;
    
    const total = testResults.length;
    const successful = testResults.filter(r => r.success).length;
    const failed = total - successful;
    const avgDuration = testResults.reduce((sum, r) => sum + r.duration, 0) / total;
    const errorTypes = testResults
      .filter(r => !r.success)
      .reduce((acc, r) => {
        const error = r.error || 'Unknown error';
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    return { total, successful, failed, avgDuration, errorTypes };
  };

  const stats = getResultStats();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Upload Stress Tester
        </h3>
        <p className="text-muted-foreground">
          Replicate Zoë's file integrity errors and Moura's client-side crashes through comprehensive stress testing.
        </p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Identified Issue:</strong> File Integrity Verification failures indicate uploads complete but files become corrupted/inaccessible afterward.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="setup">Test Setup</TabsTrigger>
          <TabsTrigger value="run">Run Tests</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="test-files">Select Test Files</Label>
                <Input
                  id="test-files"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                />
                {selectedFiles.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedFiles.length} files selected ({(selectedFiles.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(2)} MB total)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="iterations">Test Iterations</Label>
                  <Input
                    id="iterations"
                    type="number"
                    value={testIterations}
                    onChange={(e) => setTestIterations(parseInt(e.target.value) || 10)}
                    min="1"
                    max="50"
                  />
                </div>

                <div>
                  <Label htmlFor="concurrent">Concurrent Uploads</Label>
                  <Input
                    id="concurrent"
                    type="number"
                    value={concurrentUploads}
                    onChange={(e) => setConcurrentUploads(parseInt(e.target.value) || 5)}
                    min="1"
                    max="20"
                  />
                </div>

                <div>
                  <Label htmlFor="network">Network Condition</Label>
                  <select
                    id="network"
                    className="w-full p-2 border rounded"
                    value={networkCondition.name}
                    onChange={(e) => {
                      const condition = NETWORK_CONDITIONS.find(c => c.name === e.target.value);
                      if (condition) setNetworkCondition(condition);
                    }}
                  >
                    {NETWORK_CONDITIONS.map(condition => (
                      <option key={condition.name} value={condition.name}>
                        {condition.name} - {condition.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="run" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileX className="h-5 w-5" />
                  Single Upload Test
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Replicate Moura's client-side crashes with repeated single uploads.
                </p>
                <Button
                  onClick={() => runStressTest('single')}
                  disabled={isRunning || selectedFiles.length === 0}
                  className="w-full"
                >
                  {isRunning && currentTest.includes('Single') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4 mr-2" />
                  )}
                  Test Single Uploads
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Multi Upload Test
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Test multi-photo upload stability and integrity.
                </p>
                <Button
                  onClick={() => runStressTest('multi')}
                  disabled={isRunning || selectedFiles.length === 0}
                  className="w-full"
                >
                  {isRunning && currentTest.includes('Multi') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Test Multi Uploads
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Concurrent Test
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Test concurrent uploads to replicate file integrity issues.
                </p>
                <Button
                  onClick={() => runStressTest('concurrent')}
                  disabled={isRunning || selectedFiles.length === 0}
                  className="w-full"
                >
                  {isRunning && currentTest.includes('Concurrent') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Target className="h-4 w-4 mr-2" />
                  )}
                  Test Concurrent
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Large File Test
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Target Zoë's corruption issues with large file integrity testing.
                </p>
                <Button
                  onClick={() => runStressTest('large-file')}
                  disabled={isRunning || selectedFiles.length === 0}
                  className="w-full"
                  variant="destructive"
                >
                  {isRunning && currentTest.includes('Large File') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  Test Large Files
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Memory Pressure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Target Moura's crashes with memory pressure testing.
                </p>
                <Button
                  onClick={() => runStressTest('memory-pressure')}
                  disabled={isRunning || selectedFiles.length === 0}
                  className="w-full"
                  variant="destructive"
                >
                  {isRunning && currentTest.includes('Memory Pressure') ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Timer className="h-4 w-4 mr-2" />
                  )}
                  Test Memory
                </Button>
              </CardContent>
            </Card>
          </div>

          {isRunning && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{currentTest}</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Test Statistics
                  <Button variant="outline" size="sm" onClick={clearResults}>
                    Clear Results
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Total Tests</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stats.avgDuration.toFixed(0)}ms</div>
                    <div className="text-sm text-muted-foreground">Avg Duration</div>
                  </div>
                </div>

                {Object.keys(stats.errorTypes).length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Error Types:</h4>
                    <div className="space-y-1">
                      {Object.entries(stats.errorTypes).map(([error, count]) => (
                        <div key={error} className="flex justify-between text-sm">
                          <span className="truncate">{error}</span>
                          <Badge variant="destructive">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No test results yet. Run some stress tests to see results here.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {testResults.slice(0, 50).map((result, index) => (
                    <div key={result.testId} className="flex items-center gap-3 p-2 border rounded text-sm">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {result.testType}
                          </Badge>
                          <span className="truncate">{result.fileName}</span>
                          <span className="text-muted-foreground">
                            {result.duration}ms
                          </span>
                        </div>
                        {result.error && (
                          <div className="text-red-600 text-xs mt-1 truncate">
                            {result.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Loader2,
  FileImage,
  Database,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  details?: any;
  duration?: number;
}

interface FileAnalysis {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  checksum?: string;
  isValid: boolean;
  bufferSize?: number;
  uploadResult?: any;
}

export function UploadCorruptionDiagnostic() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [testUserId] = useState('diagnostic-test-user');
  const { toast } = useToast();

  const diagnosticSteps: DiagnosticResult[] = [
    { step: 'File Validation', status: 'pending' },
    { step: 'Buffer Conversion', status: 'pending' },
    { step: 'Checksum Calculation', status: 'pending' },
    { step: 'Firebase Upload Test', status: 'pending' },
    { step: 'File Integrity Verification', status: 'pending' },
    { step: 'Cleanup Test Files', status: 'pending' }
  ];

  // Calculate file checksum for integrity verification
  const calculateChecksum = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Analyze file before upload
  const analyzeFile = async (file: File): Promise<FileAnalysis> => {
    const checksum = await calculateChecksum(file);
    const buffer = await file.arrayBuffer();
    
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      checksum,
      bufferSize: buffer.byteLength,
      isValid: buffer.byteLength === file.size && file.size > 0
    };
  };

  // Update diagnostic step status
  const updateStep = (stepName: string, status: DiagnosticResult['status'], message?: string, details?: any, duration?: number) => {
    setDiagnosticResults(prev => prev.map(step => 
      step.step === stepName 
        ? { ...step, status, message, details, duration }
        : step
    ));
  };

  // Run comprehensive diagnostic
  const runDiagnostic = async () => {
    if (!selectedFile) return;

    setIsRunning(true);
    setProgress(0);
    setDiagnosticResults([...diagnosticSteps]);

    try {
      // Step 1: File Validation
      updateStep('File Validation', 'running');
      const startTime = Date.now();
      
      const analysis = await analyzeFile(selectedFile);
      setFileAnalysis(analysis);
      
      if (!analysis.isValid) {
        updateStep('File Validation', 'error', 'File appears to be corrupted or invalid', analysis);
        return;
      }
      
      updateStep('File Validation', 'success', 'File is valid', analysis, Date.now() - startTime);
      setProgress(16);

      // Step 2: Buffer Conversion Test
      updateStep('Buffer Conversion', 'running');
      const bufferStart = Date.now();
      
      try {
        const buffer = Buffer.from(await selectedFile.arrayBuffer());
        const bufferChecksum = require('crypto').createHash('sha256').update(buffer).digest('hex');
        
        updateStep('Buffer Conversion', 'success', 
          `Buffer created successfully (${buffer.length} bytes)`, 
          { bufferSize: buffer.length, bufferChecksum },
          Date.now() - bufferStart
        );
      } catch (error) {
        updateStep('Buffer Conversion', 'error', 
          `Buffer conversion failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return;
      }
      setProgress(33);

      // Step 3: Checksum Calculation
      updateStep('Checksum Calculation', 'running');
      const checksumStart = Date.now();
      
      try {
        const originalChecksum = analysis.checksum;
        const bufferChecksum = require('crypto').createHash('sha256').update(Buffer.from(await selectedFile.arrayBuffer())).digest('hex');
        
        if (originalChecksum === bufferChecksum) {
          updateStep('Checksum Calculation', 'success', 
            'Checksums match - no corruption detected', 
            { originalChecksum, bufferChecksum },
            Date.now() - checksumStart
          );
        } else {
          updateStep('Checksum Calculation', 'error', 
            'Checksum mismatch - potential corruption detected', 
            { originalChecksum, bufferChecksum }
          );
        }
      } catch (error) {
        updateStep('Checksum Calculation', 'error', 
          `Checksum calculation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      setProgress(50);

      // Step 4: Firebase Upload Test
      updateStep('Firebase Upload Test', 'running');
      const uploadStart = Date.now();
      
      try {
        const formData = new FormData();
        formData.append('photo', selectedFile);
        formData.append('userId', testUserId);

        const response = await fetch('/api/debug/test-upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        
        if (result.success) {
          updateStep('Firebase Upload Test', 'success', 
            'Upload completed successfully', 
            result,
            Date.now() - uploadStart
          );
          analysis.uploadResult = result;
        } else {
          updateStep('Firebase Upload Test', 'error', 
            `Upload failed: ${result.message}`, 
            result
          );
        }
      } catch (error) {
        updateStep('Firebase Upload Test', 'error', 
          `Upload test failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      setProgress(75);

      // Step 5: File Integrity Verification
      if (analysis.uploadResult?.fileUrl) {
        updateStep('File Integrity Verification', 'running');
        const verifyStart = Date.now();
        
        try {
          const response = await fetch(analysis.uploadResult.fileUrl, { method: 'HEAD' });
          
          if (response.ok) {
            const uploadedSize = response.headers.get('content-length');
            const originalSize = selectedFile.size.toString();
            
            if (uploadedSize === originalSize) {
              updateStep('File Integrity Verification', 'success', 
                'Uploaded file size matches original', 
                { originalSize, uploadedSize },
                Date.now() - verifyStart
              );
            } else {
              updateStep('File Integrity Verification', 'error', 
                'File size mismatch - upload may be corrupted', 
                { originalSize, uploadedSize }
              );
            }
          } else {
            updateStep('File Integrity Verification', 'error', 
              `Cannot access uploaded file: ${response.status} ${response.statusText}`
            );
          }
        } catch (error) {
          updateStep('File Integrity Verification', 'error', 
            `Verification failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else {
        updateStep('File Integrity Verification', 'error', 'No upload URL to verify');
      }
      setProgress(90);

      // Step 6: Cleanup
      updateStep('Cleanup Test Files', 'running');
      if (analysis.uploadResult?.filePath) {
        try {
          await fetch('/api/debug/cleanup-test-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: analysis.uploadResult.filePath })
          });
          updateStep('Cleanup Test Files', 'success', 'Test files cleaned up');
        } catch (error) {
          updateStep('Cleanup Test Files', 'error', 'Cleanup failed - manual cleanup may be needed');
        }
      } else {
        updateStep('Cleanup Test Files', 'success', 'No files to clean up');
      }
      setProgress(100);

    } catch (error) {
      toast({
        title: 'Diagnostic Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileAnalysis(null);
      setDiagnosticResults([]);
      setProgress(0);
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'running':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Upload Corruption Diagnostic
        </h3>
        <p className="text-muted-foreground">
          Comprehensive analysis to identify why uploads are getting corrupted in Firebase Storage.
        </p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Issue:</strong> Zoë's photos show "Error loading preview" in Firebase Storage, 
          indicating corrupted or incomplete uploads even after deletion and re-upload attempts.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            File Selection & Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="diagnostic-file">Select a file to diagnose</Label>
            <Input
              id="diagnostic-file"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={isRunning}
            />
          </div>

          {selectedFile && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Selected File</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Name:</strong> {selectedFile.name}</div>
                <div><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                <div><strong>Type:</strong> {selectedFile.type}</div>
                <div><strong>Modified:</strong> {new Date(selectedFile.lastModified).toLocaleString()}</div>
              </div>
            </div>
          )}

          <Button
            onClick={runDiagnostic}
            disabled={!selectedFile || isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Diagnostic...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Run Upload Corruption Diagnostic
              </>
            )}
          </Button>

          {isRunning && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                {progress}% Complete
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {diagnosticResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnostic Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {diagnosticResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${getStatusColor(result.status)}`}>
                        {result.step}
                      </span>
                      {result.duration && (
                        <Badge variant="outline" className="text-xs">
                          {result.duration}ms
                        </Badge>
                      )}
                    </div>
                    
                    {result.message && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {result.message}
                      </p>
                    )}
                    
                    {result.details && (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {fileAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>File Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>File Valid:</strong> {fileAnalysis.isValid ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Checksum:</strong> {fileAnalysis.checksum?.substring(0, 16)}...</div>
              <div><strong>Buffer Size:</strong> {fileAnalysis.bufferSize} bytes</div>
              <div><strong>Original Size:</strong> {fileAnalysis.size} bytes</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

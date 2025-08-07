/**
 * Upload Resilience Utilities
 * Fixes for real-world upload issues including network failures and file corruption
 */

export interface UploadOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeoutMs?: number;
  chunkSize?: number;
  validateIntegrity?: boolean;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  retryCount?: number;
  duration?: number;
}

/**
 * Calculate file checksum for integrity verification
 */
export async function calculateFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retry mechanism with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Upload attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
    }
  }
  
  throw lastError!;
}

/**
 * Upload with timeout protection
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Memory-efficient file processing
 */
export function processFileInChunks(
  file: File,
  chunkSize: number = 1024 * 1024 // 1MB chunks
): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const reader = new FileReader();
    let offset = 0;
    
    const readNextChunk = () => {
      if (offset >= file.size) {
        resolve(chunks);
        return;
      }
      
      const chunk = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(chunk);
    };
    
    reader.onload = (event) => {
      if (event.target?.result) {
        chunks.push(new Uint8Array(event.target.result as ArrayBuffer));
        offset += chunkSize;
        
        // Small delay to prevent UI blocking
        setTimeout(readNextChunk, 10);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file chunk'));
    
    readNextChunk();
  });
}

/**
 * Enhanced upload with all resilience features
 */
export async function resilientUpload(
  file: File,
  uploadAction: (formData: FormData) => Promise<any>,
  userId: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    timeoutMs = 60000, // 1 minute
    validateIntegrity = true
  } = options;
  
  const startTime = Date.now();
  let retryCount = 0;
  let originalChecksum: string | undefined;
  
  try {
    // Pre-upload validation
    if (file.size === 0) {
      throw new Error('File is empty');
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('File too large (max 10MB)');
    }
    
    // Calculate checksum for integrity verification
    if (validateIntegrity) {
      originalChecksum = await calculateFileChecksum(file);
    }
    
    // Upload with retry mechanism
    const result = await withRetry(async () => {
      retryCount++;
      
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('userId', userId);
      
      if (originalChecksum) {
        formData.append('checksum', originalChecksum);
      }
      
      // Upload with timeout protection
      return await withTimeout(
        uploadAction(formData),
        timeoutMs,
        `Upload timed out after ${timeoutMs}ms`
      );
    }, maxRetries, retryDelay);
    
    const duration = Date.now() - startTime;
    
    if (!result.success) {
      return {
        success: false,
        error: result.message || 'Upload failed',
        retryCount,
        duration
      };
    }
    
    return {
      success: true,
      url: result.url,
      retryCount,
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Resilient upload failed:', {
      fileName: file.name,
      fileSize: file.size,
      retryCount,
      duration,
      error: errorMessage
    });
    
    return {
      success: false,
      error: errorMessage,
      retryCount,
      duration
    };
  }
}

/**
 * Batch upload with concurrency control and resilience
 */
export async function resilientBatchUpload(
  files: File[],
  uploadAction: (formData: FormData) => Promise<any>,
  userId: string,
  options: UploadOptions & { concurrency?: number } = {}
): Promise<UploadResult[]> {
  const { concurrency = 3 } = options;
  const results: UploadResult[] = [];
  
  // Process files in batches to control concurrency
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    
    const batchPromises = batch.map(file =>
      resilientUpload(file, uploadAction, userId, options)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to prevent overwhelming the server
    if (i + concurrency < files.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

/**
 * Network connectivity check
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-cache'
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get network quality estimate
 */
export async function estimateNetworkQuality(): Promise<'good' | 'poor' | 'offline'> {
  const startTime = Date.now();
  
  try {
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      return 'offline';
    }
    
    const duration = Date.now() - startTime;
    return duration < 1000 ? 'good' : 'poor';
    
  } catch {
    return 'offline';
  }
}

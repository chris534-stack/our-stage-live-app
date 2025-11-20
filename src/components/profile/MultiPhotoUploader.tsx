'use client';

import React, { useState, useTransition, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadMultiplePhotosAction } from '@/lib/actions';
import { Loader2, UploadCloud, X, FolderOpen, Image, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface MultiPhotoUploaderProps {
  userId: string;
  onUploadComplete: () => void;
  isGridItem?: boolean;
  limit: number;
  currentCount: number;
}

interface FileWithPreview extends File {
  preview?: string;
}

// Extend HTMLInputElement to include webkitdirectory
declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

export function MultiPhotoUploader({ 
  userId, 
  onUploadComplete, 
  isGridItem = false, 
  limit, 
  currentCount 
}: MultiPhotoUploaderProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const photosRemaining = limit - currentCount;
  const maxFilesToSelect = Math.min(photosRemaining, 20); // Reasonable batch limit

  // Handle file validation
  const validateFiles = useCallback((files: File[]) => {
    const validFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    // Limit total files to prevent memory issues
    const filesToProcess = files.slice(0, maxFilesToSelect);
    if (files.length > maxFilesToSelect) {
      errors.push(`Only processing first ${maxFilesToSelect} files to prevent memory issues`);
    }

    filesToProcess.forEach((file) => {
      try {
        // Check file type
        if (!file.type.startsWith('image/')) {
          errors.push(`${file.name} is not an image file`);
          return;
        }

        // Allow HEIC/HEIF selection; we'll convert before upload. Preview may not render for HEIC.

        // Check file size (5MB limit to prevent crashes)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          errors.push(`${file.name} is too large (max 10MB)`);
          return;
        }

        // Check for corrupted files
        if (file.size === 0) {
          errors.push(`${file.name} appears to be corrupted (0 bytes)`);
          return;
        }

        // Add preview URL for display with error handling
        const fileWithPreview = file as FileWithPreview;
        try {
          fileWithPreview.preview = URL.createObjectURL(file);
          validFiles.push(fileWithPreview);
        } catch (previewError) {
          console.error(`Failed to create preview for ${file.name}:`, previewError);
          errors.push(`${file.name} could not be previewed`);
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errors.push(`${file.name} could not be processed`);
      }
    });

    // Check total count
    const totalAfterUpload = currentCount + selectedFiles.length + validFiles.length;
    if (totalAfterUpload > limit) {
      const allowedCount = limit - currentCount - selectedFiles.length;
      if (allowedCount > 0) {
        errors.push(`Only ${allowedCount} more photos can be added (limit: ${limit})`);
        return validFiles.slice(0, allowedCount);
      } else {
        errors.push(`Photo limit reached (${limit} photos max)`);
        return [];
      }
    }

    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Some files were skipped',
        description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? '...' : ''),
      });
    }

    return validFiles;
  }, [currentCount, selectedFiles.length, limit, toast]);

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = validateFiles(acceptedFiles);
    setSelectedFiles(prev => [...prev, ...validFiles]);
  }, [validateFiles]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic', '.heif']
    },
    multiple: true,
    maxFiles: maxFilesToSelect,
    disabled: isPending,
    noClick: true, // Disable automatic click-to-open to prevent double file picker
    noKeyboard: true // Also disable keyboard activation for consistency
  });

  // Handle manual file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = validateFiles(files);
    setSelectedFiles(prev => [...prev, ...validFiles]);
    event.target.value = ''; // Reset input
  };

  // Handle folder selection
  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = validateFiles(files);
    setSelectedFiles(prev => [...prev, ...validFiles]);
    event.target.value = ''; // Reset input
  };

  // Remove selected file
  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Convert HEIC/HEIF to JPEG using browser-side library (dynamic import to avoid SSR issues)
  const convertHeicIfNeeded = async (file: File): Promise<File> => {
    try {
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
      if (!isHeic) return file;

      // Dynamic import so it only loads in the browser
      const mod: any = await import('heic2any');
      const toBlob = await mod.default({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const blob: Blob = Array.isArray(toBlob) ? toBlob[0] : toBlob;
      const newName = file.name.replace(/\.(heic|heif)$/i, '') + '.jpg';
      const converted = new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
      return converted;
    } catch (err) {
      console.warn('HEIC conversion failed, skipping file:', file.name, err);
      throw new Error(`${file.name} could not be converted from HEIC/HEIF.`);
    }
  };

  // Upload all selected files with enhanced error handling
  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    // Validate files again before upload to catch any issues
    const validFiles = selectedFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        console.warn(`Skipping non-image file: ${file.name}`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`Skipping oversized file: ${file.name}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'No valid files to upload.',
      });
      return;
    }

    startTransition(async () => {
      try {
        setUploadProgress(0);

        const CONCURRENCY = 3; // keep requests small and parallel
        const total = validFiles.length;
        let processed = 0;
        let succeeded = 0;
        const errors: string[] = [];
        let index = 0;

        const uploadSingle = async (file: File) => {
          // Convert HEIC/HEIF to JPEG before upload
          let toUpload = file;
          if (file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name)) {
            try {
              toUpload = await convertHeicIfNeeded(file);
            } catch (convErr) {
              throw convErr;
            }
          }
          const fd = new FormData();
          fd.append('userId', userId);
          // Send one file per request to keep body size small
          fd.append('photos', toUpload);

          const res = await fetch('/api/upload/multiple', {
            method: 'POST',
            body: fd
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!json.success) throw new Error(json.message || 'Upload failed');
        };

        const runNext = async (): Promise<void> => {
          const current = index++;
          if (current >= total) return;
          const file = validFiles[current];
          try {
            await uploadSingle(file);
            succeeded++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            console.error('Upload failed for', file.name, msg);
            errors.push(`${file.name}: ${msg}`);
          } finally {
            processed++;
            setUploadProgress(Math.round((processed / total) * 100));
            // Continue pipeline
            await runNext();
          }
        };

        // Start worker pool
        const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => runNext());
        await Promise.all(workers);

        // Cleanup previews
        selectedFiles.forEach(file => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview);
          }
        });
        setSelectedFiles([]);

        if (succeeded > 0) {
          toast({
            title: 'Upload complete',
            description: errors.length === 0
              ? `Uploaded ${succeeded} photo${succeeded !== 1 ? 's' : ''}.`
              : `Uploaded ${succeeded} of ${total}. ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? '...' : ''}`,
          });
          setUploadProgress(0);
          onUploadComplete();
        } else {
          toast({
            variant: 'destructive',
            title: 'Upload failed',
            description: errors.slice(0, 3).join(', ') || 'All uploads failed.',
          });
          setUploadProgress(0);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast({
          variant: 'destructive',
          title: 'Upload error',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
        setUploadProgress(0);
      }
    });
  };

  // Safe cleanup function for preview URLs
  const cleanupPreviewUrls = () => {
    try {
      selectedFiles.forEach(file => {
        if (file.preview) {
          try {
            URL.revokeObjectURL(file.preview);
          } catch (error) {
            console.warn(`Failed to revoke URL for ${file.name}:`, error);
          }
        }
      });
    } catch (error) {
      console.error('Error during preview URL cleanup:', error);
    }
  };

  // Clear all selected files with safe cleanup
  const clearFiles = () => {
    cleanupPreviewUrls();
    setSelectedFiles([]);
  };

  // Cleanup on component unmount
  React.useEffect(() => {
    return () => {
      cleanupPreviewUrls();
    };
  }, [selectedFiles]);

  const dropzoneClasses = cn(
    "flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg transition-colors",
    isDragActive && "border-primary bg-primary/5",
    isDragAccept && "border-green-500 bg-green-50",
    isDragReject && "border-red-500 bg-red-50",
    isPending && "cursor-not-allowed opacity-50"
  );

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg transition-colors",
        isDragActive && "border-primary bg-primary/5",
        isGridItem ? "aspect-square p-2 sm:p-4 h-full w-full" : "p-8",
        selectedFiles.length > 0 && !isGridItem && "min-h-[400px]"
      )}
      style={isGridItem ? { maxHeight: '100%', overflow: 'hidden' } : {}}
    >
      <input {...getInputProps()} />
      
      {isPending ? (
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p className="font-medium text-sm">Uploading...</p>
          {uploadProgress > 0 && (
            <div className="w-full max-w-xs mt-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs mt-1">{uploadProgress}% complete</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <UploadCloud className="h-12 w-12 mb-4 text-muted-foreground" />
          
          {isDragActive ? (
            <div>
              <p className="font-medium text-foreground">Drop photos here</p>
              <p className="text-sm">Release to add photos to your gallery</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-foreground text-lg mb-2">Add Multiple Photos</p>
              <p className="text-sm mb-4">
                Drag & drop photos here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                You can add up to {photosRemaining} more photo{photosRemaining !== 1 ? 's' : ''}
              </p>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2"
                >
                  <Smartphone className="h-4 w-4" />
                  Select Photos
                </Button>
                  
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    folderInputRef.current?.click();
                  }}
                  className="hidden sm:flex items-center gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  Select Folder
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        className="sr-only"
        onChange={handleFileSelect}
        disabled={isPending}
      />
      
      <input
        ref={folderInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        webkitdirectory=""
        className="sr-only"
        onChange={handleFolderSelect}
        disabled={isPending}
      />

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && !isGridItem && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              Selected Photos ({selectedFiles.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFiles}
              disabled={isPending}
              className="text-xs"
            >
              Clear All
            </Button>
          </div>
          
          {/* File Grid */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => removeFile(index)}
                  disabled={isPending}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                
                <p className="text-xs text-center mt-1 truncate" title={file.name}>
                  {file.name}
                </p>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <Button
            onClick={uploadFiles}
            disabled={isPending || selectedFiles.length === 0}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

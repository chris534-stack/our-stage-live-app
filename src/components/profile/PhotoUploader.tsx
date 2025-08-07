

'use client';

import { useState, useTransition, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadProfilePhotoAction } from '@/lib/actions';
import { resilientUpload, checkNetworkConnectivity, estimateNetworkQuality } from '@/lib/upload-resilience';
import { Loader2, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoUploaderProps {
  userId: string;
  onUploadComplete: () => void;
  isGridItem?: boolean; // To style it as a grid item or as the main content
  limit: number;
  currentCount: number;
}

const formSchema = z.object({
  photo: z.any()
    .refine((files) => files?.length === 1, "An image is required.")
    .refine((files) => files?.[0]?.type.startsWith("image/"), "Only image files are accepted."),
});

export function PhotoUploader({ userId, onUploadComplete, isGridItem = false, limit, currentCount }: PhotoUploaderProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRemaining = limit - currentCount;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        const file = files[0];
        
        // Validate file before upload to prevent crashes
        try {
            // Check file type
            if (!file.type.startsWith('image/')) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid file type',
                    description: 'Please select an image file.',
                });
                return;
            }
            
            // Check file size (10MB limit)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                toast({
                    variant: 'destructive',
                    title: 'File too large',
                    description: 'Please select a file smaller than 10MB.',
                });
                return;
            }
            
            // Check for corrupted files
            if (file.size === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid file',
                    description: 'The selected file appears to be corrupted.',
                });
                return;
            }

            startTransition(async () => {
                try {
                    // Check network connectivity first
                    const isOnline = await checkNetworkConnectivity();
                    if (!isOnline) {
                        toast({
                            title: 'No internet connection',
                            description: 'Please check your internet connection and try again.',
                            variant: 'destructive'
                        });
                        return;
                    }

                    // Check network quality and warn user if poor
                    const networkQuality = await estimateNetworkQuality();
                    if (networkQuality === 'poor') {
                        toast({
                            title: 'Slow connection detected',
                            description: 'Upload may take longer due to poor network conditions.',
                        });
                    }

                    // Use resilient upload with retry mechanism
                    const result = await resilientUpload(
                        file,
                        uploadProfilePhotoAction,
                        userId,
                        {
                            maxRetries: 3,
                            retryDelay: 2000,
                            timeoutMs: 90000, // 1.5 minutes
                            validateIntegrity: true
                        }
                    );

                    if (result.success) {
                        const retryInfo = result.retryCount && result.retryCount > 1 
                            ? ` (succeeded after ${result.retryCount} attempts)` 
                            : '';
                        
                        toast({
                            title: 'Photo uploaded successfully!' + retryInfo,
                            description: `Upload completed in ${Math.round((result.duration || 0) / 1000)}s.`
                        });
                        onUploadComplete();
                        form.reset();
                    } else {
                        console.error('Resilient upload failed:', {
                            error: result.error,
                            retryCount: result.retryCount,
                            duration: result.duration
                        });
                        
                        const retryInfo = result.retryCount && result.retryCount > 1 
                            ? ` (failed after ${result.retryCount} attempts)` 
                            : '';
                        
                        toast({
                            title: 'Upload failed' + retryInfo,
                            description: result.error || 'Failed to upload photo. Please try again.',
                            variant: 'destructive'
                        });
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    toast({
                        title: 'Upload error',
                        description: errorMessage,
                        variant: 'destructive'
                    });
                }
            });
        } catch (error) {
            console.error('File validation error:', error);
            toast({
                variant: 'destructive',
                title: 'File validation failed',
                description: 'Could not process the selected file. Please try again.',
            });
        }
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg",
        isGridItem && "aspect-square p-2 sm:p-4 h-full"
      )}
    >
        {isPending ? (
            <div className="flex flex-col items-center">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mb-2" />
                <p className="font-medium text-xs sm:text-sm">Uploading...</p>
            </div>
        ) : (
            <>
                <Form {...form}>
                    <form className="flex flex-col items-center justify-center h-full">
                        <FormField
                            control={form.control}
                            name="photo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            className="sr-only"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            disabled={isPending}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                         <UploadCloud className="h-6 w-6 sm:h-8 sm:w-8 mb-1" />
                         <p className="font-medium text-foreground text-xs sm:text-sm">Add to Gallery</p>
                         <p className="text-[10px] sm:text-xs leading-tight mt-1 mb-2">You can add {photosRemaining} more photo{photosRemaining !== 1 ? 's' : ''}.</p>
                         <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isPending}
                         >
                            Upload Photo
                         </Button>
                    </form>
                </Form>
            </>
        )}
    </div>
  );
}

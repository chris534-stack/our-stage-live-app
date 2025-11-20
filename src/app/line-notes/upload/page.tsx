"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Camera, FileText, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function UploadScriptPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!user || selectedFiles.length === 0) return;

    setUploading(true);
    
    try {
      // Create FormData with files
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('userId', user.uid);
      formData.append('title', selectedFiles[0].name.replace(/\.[^/.]+$/, '')); // Use first filename as title

      // Process with Gemini Vision OCR
      const response = await fetch('/api/scripts/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Processing failed');
      }

      const result = await response.json();
      console.log('OCR Result:', result);
      
      // Check if duplicate
      if (result.duplicate) {
        if (confirm(`This script has already been uploaded. Would you like to view it instead?`)) {
          router.push(`/line-notes/script/${result.scriptId}`);
        } else {
          setUploading(false);
          setSelectedFiles([]);
        }
        return;
      }
      
      // Redirect to the new script
      router.push(`/line-notes/script/${result.scriptId}`);
    } catch (error) {
      console.error("Upload failed:", error);
      alert(error instanceof Error ? error.message : 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" className="gap-2 mb-4" asChild>
          <Link href="/line-notes">
            <ArrowLeft className="h-4 w-4" />
            Back to Scripts
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Upload Script</h1>
        <p className="text-muted-foreground mt-1">
          Take photos or upload PDFs of your script pages
        </p>
      </div>

      <div className="space-y-6">
        {/* Upload Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Take Photos</CardTitle>
                  <CardDescription>Use your phone camera</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" className="w-full" asChild>
                  <span>Open Camera</span>
                </Button>
              </label>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Upload Files</CardTitle>
                  <CardDescription>PDF or images</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <label className="block">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" className="w-full" asChild>
                  <span>Choose Files</span>
                </Button>
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Selected Files ({selectedFiles.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Button */}
        {selectedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ready to process</CardTitle>
              <CardDescription>
                We'll scan your script, extract the text, and identify all characters and scenes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="lg" 
                className="w-full gap-2" 
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Process Script
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                This usually takes 30-60 seconds
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Tips for best results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Make sure text is clear and readable</p>
            <p>• Good lighting helps with accuracy</p>
            <p>• Include all pages of scenes you're in</p>
            <p>• Character names should be visible</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

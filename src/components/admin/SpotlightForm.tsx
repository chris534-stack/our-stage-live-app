'use client';

import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X, Trash2, AlertTriangle, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { CommunitySpotlight } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createSpotlightAction, updateSpotlightAction, deleteSpotlightAction, uploadSpotlightPhotoAction } from '@/lib/actions';

const spotlightSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  story: z.string().min(10, 'Story must be at least 10 characters').max(2000, 'Story must be less than 2000 characters'),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  isActive: z.boolean(),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  social: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  adminNotes: z.string().max(500, 'Admin notes must be less than 500 characters').optional(),
});

type SpotlightFormData = z.infer<typeof spotlightSchema>;

interface SpotlightFormProps {
  spotlight?: CommunitySpotlight;
  onSuccess: (spotlight: CommunitySpotlight) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}

const commonTags = [
  'Actor', 'Director', 'Producer', 'Designer', 'Technician', 'Volunteer',
  'Board Member', 'Mentor', 'Educator', 'Playwright', 'Musician', 'Dancer',
  'Choreographer', 'Stage Manager', 'Lighting Designer', 'Sound Designer',
  'Costume Designer', 'Set Designer', 'Props Master', 'Makeup Artist'
];

export function SpotlightForm({ spotlight, onSuccess, onCancel, onDelete }: SpotlightFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(spotlight?.photoUrl || '');
  const [currentTags, setCurrentTags] = useState<string[]>(spotlight?.tags || []);
  const [newTag, setNewTag] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = (event: React.ClipboardEvent, onChange: (files: FileList | null) => void) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                onChange(dataTransfer.files);
                toast({
                    title: "Image Pasted!",
                    description: "The photo has been added from your clipboard.",
                });
                break;
            }
        }
    }
  };
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch
  } = useForm<SpotlightFormData>({
    resolver: zodResolver(spotlightSchema),
    defaultValues: {
      name: spotlight?.name || '',
      story: spotlight?.story || '',
      tags: spotlight?.tags || [],
      isActive: spotlight?.isActive || false,
      website: spotlight?.links?.website || '',
      social: spotlight?.links?.social || '',
      adminNotes: spotlight?.adminNotes || '',
    }
  });

  const isActive = watch('isActive');

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an image file.',
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB.',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('type', 'spotlight');

      const result = await uploadSpotlightPhotoAction(formData);
      if (result.success && result.url) {
        setPhotoUrl(result.url);
        toast({
          title: 'Success!',
          description: 'Photo uploaded successfully.',
        });
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload photo.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !currentTags.includes(trimmedTag)) {
      const newTags = [...currentTags, trimmedTag];
      setCurrentTags(newTags);
      setValue('tags', newTags);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = currentTags.filter(tag => tag !== tagToRemove);
    setCurrentTags(newTags);
    setValue('tags', newTags);
  };

  const onSubmit = async (data: SpotlightFormData) => {
    if (!photoUrl) {
      toast({
        variant: 'destructive',
        title: 'Photo required',
        description: 'Please upload a photo for the spotlight.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const spotlightData = {
        name: data.name,
        story: data.story,
        photoUrl,
        tags: currentTags,
        isActive: data.isActive,
        links: {
          website: data.website || undefined,
          social: data.social || undefined,
        },
        adminNotes: data.adminNotes || undefined,
      };

      let result;
      if (spotlight) {
        // Update existing spotlight
        result = await updateSpotlightAction(spotlight.id, spotlightData);
      } else {
        // Create new spotlight
        result = await createSpotlightAction(spotlightData);
      }

      if (result.success && result.spotlight) {
        onSuccess(result.spotlight);
      } else {
        throw new Error(result.message || 'Operation failed');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!spotlight || !onDelete) return;

    try {
      const result = await deleteSpotlightAction(spotlight.id);
      if (result.success) {
        onDelete(spotlight.id);
      } else {
        throw new Error(result.message || 'Delete failed');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete spotlight.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Photo Upload */}
      <div className="space-y-2">
        <Label htmlFor="photo">Photo *</Label>
        <div 
          className="relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary/50"
          onPaste={(e) => handlePaste(e, (files) => {
            if (fileInputRef.current && files) {
              fileInputRef.current.files = files;
              handlePhotoUpload({ target: { files } } as React.ChangeEvent<HTMLInputElement>);
            }
          })}
          tabIndex={0}
        >
          <Input 
            type="file" 
            accept="image/*"
            className="sr-only"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
          />
          <div className="flex flex-col items-center text-center pointer-events-none">
            <ClipboardPaste className="w-10 h-10 mb-2" />
            <p className="font-semibold text-foreground">
              Paste an image from your clipboard
            </p>
            <p className="text-sm">Press Ctrl+V or ⌘+V in this box</p>
            
            <div className="my-4 flex items-center w-full max-w-xs">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink mx-4 text-xs uppercase">Or</span>
              <div className="flex-grow border-t border-border"></div>
            </div>
            
            <Button 
              type="button" 
              variant="outline" 
              className="pointer-events-auto"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload a File'}
            </Button>
          </div>
          {photoUrl && (
            <div className="absolute top-2 right-2">
              <img 
                src={photoUrl} 
                alt="Spotlight photo" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setPhotoUrl('')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Enter the person's name"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Story */}
      <div className="space-y-2">
        <Label htmlFor="story">Recognition Story *</Label>
        <Textarea
          id="story"
          {...register('story')}
          placeholder="Write about why this person deserves recognition, their contributions to the community, and what makes them special..."
          rows={6}
        />
        {errors.story && (
          <p className="text-sm text-destructive">{errors.story.message}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Roles & Tags *</Label>
        <div className="space-y-3">
          {/* Current Tags */}
          {currentTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          
          {/* Add Custom Tag */}
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add custom tag..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(newTag);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => addTag(newTag)}
              disabled={!newTag.trim()}
            >
              Add
            </Button>
          </div>
          
          {/* Common Tags */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Quick add:</p>
            <div className="flex flex-wrap gap-2">
              {commonTags.filter(tag => !currentTags.includes(tag)).slice(0, 8).map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        </div>
        {errors.tags && (
          <p className="text-sm text-destructive">{errors.tags.message}</p>
        )}
      </div>

      {/* Links */}
      <div className="space-y-4">
        <Label>Optional Links</Label>
        <div className="space-y-3">
          <div>
            <Label htmlFor="website" className="text-sm">Website</Label>
            <Input
              id="website"
              {...register('website')}
              placeholder="https://example.com"
            />
            {errors.website && (
              <p className="text-sm text-destructive">{errors.website.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="social" className="text-sm">Social Media</Label>
            <Input
              id="social"
              {...register('social')}
              placeholder="https://instagram.com/username"
            />
            {errors.social && (
              <p className="text-sm text-destructive">{errors.social.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Admin Notes */}
      <div className="space-y-2">
        <Label htmlFor="adminNotes">Admin Notes (Internal)</Label>
        <Textarea
          id="adminNotes"
          {...register('adminNotes')}
          placeholder="Internal notes for admin reference..."
          rows={3}
        />
        {errors.adminNotes && (
          <p className="text-sm text-destructive">{errors.adminNotes.message}</p>
        )}
      </div>

      {/* Active Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="space-y-1">
          <Label htmlFor="isActive">Make Active Spotlight</Label>
          <p className="text-sm text-muted-foreground">
            {isActive 
              ? 'This spotlight will be displayed on the homepage' 
              : 'This spotlight will be saved as a draft'
            }
          </p>
        </div>
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <Switch
              id="isActive"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        
        {spotlight && onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete Spotlight
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the spotlight for "{spotlight.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        
        <Button type="submit" disabled={isSubmitting} className="sm:ml-auto">
          {isSubmitting 
            ? (spotlight ? 'Updating...' : 'Creating...') 
            : (spotlight ? 'Update Spotlight' : 'Create Spotlight')
          }
        </Button>
      </div>
    </form>
  );
}

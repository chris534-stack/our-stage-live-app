
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useMemo, useState, useEffect } from 'react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addEventFromFormAction, updateEventAction, uploadEventPosterAction } from '@/lib/actions';
import type { ScrapeEventDetailsOutput } from '@/ai/flows/scrape-event-details';
import type { Venue, Event } from '@/lib/types';
import { Loader2, PlusCircle, XCircle } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { getClientAuth } from '@/lib/firebase';

const eventFormSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  url: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal("")),
  posterUrl: z.string().url({ message: 'Poster must be a valid URL.' }).optional().or(z.literal("")),
  venueId: z.string().min(1, 'Venue is required.'),
  type: z.string().min(1, 'Type is required.'),
  tags: z.string().optional(),
  occurrences: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
    time: z.string().regex(/^$|^\d{2}:\d{2}$/, 'Time must be in HH:mm format or empty.'),
  })).min(1, 'At least one occurrence is required.'),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventEditorFormProps {
    initialData?: ScrapeEventDetailsOutput & { sourceUrl?: string };
    eventToEdit?: Event;
    venues: Venue[];
    onSuccess: () => void;
    demoMode?: boolean;
    submitLabel?: string;
}

export function EventEditorForm({ initialData, eventToEdit, venues, onSuccess, demoMode = false, submitLabel }: EventEditorFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const isEditMode = !!eventToEdit;
  const { user, isAdmin, isVenueRep, assignedVenueIds } = useAuth();

  const filteredVenues = useMemo(() => {
    // In demo mode, allow all venues for a smoother walkthrough
    if (demoMode || isAdmin) return venues;
    if (isVenueRep) return venues.filter(v => assignedVenueIds.includes(v.id));
    return venues;
  }, [venues, isAdmin, isVenueRep, assignedVenueIds, demoMode]);

  const displayVenues = useMemo(() => {
    // Ensure current event's venue appears in list for edit mode even if not in filtered list
    if (isEditMode && eventToEdit) {
      const exists = filteredVenues.some(v => v.id === eventToEdit.venueId);
      if (!exists) {
        const currentVenue = venues.find(v => v.id === eventToEdit.venueId);
        return currentVenue ? [...filteredVenues, currentVenue] : filteredVenues;
      }
    }
    return filteredVenues;
  }, [filteredVenues, isEditMode, eventToEdit, venues]);

  const venueSelectDisabled = isEditMode && isVenueRep && !isAdmin && !demoMode;

  const getInitialValues = () => {
    if (isEditMode) {
        return {
            title: eventToEdit.title || '',
            description: eventToEdit.description || '',
            url: eventToEdit.url || '',
            posterUrl: eventToEdit.posterUrl || '',
            venueId: eventToEdit.venueId || '',
            type: eventToEdit.type || 'Special Event',
            tags: eventToEdit.tags?.join(', ') || '',
            occurrences: eventToEdit.occurrences?.length ? eventToEdit.occurrences : [{ date: '', time: '' }],
        };
    }
    if (initialData) {
        const foundVenue = venues.find(v => v.name === initialData.venue);
        const mappedOccurrences = initialData.occurrences?.length 
            ? initialData.occurrences.map(o => ({ date: o.date, time: o.time || '' }))
            : [{ date: '', time: '' }];

        return {
            title: toTitleCase(initialData.title) || '',
            description: initialData.description || '',
            url: initialData.sourceUrl || '',
            posterUrl: '',
            venueId: foundVenue?.id || '',
            type: 'Special Event',
            tags: initialData.tags?.join(', ') || '',
            occurrences: mappedOccurrences,
        };
    }
    return {
        title: '', description: '', url: '', posterUrl: '', venueId: '', type: 'Special Event', tags: '', occurrences: [{ date: '', time: '' }],
    };
  };

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: getInitialValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "occurrences",
  });

  // Poster upload state
  const [selectedPoster, setSelectedPoster] = useState<File | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);

  useEffect(() => {
    if (selectedPoster) {
      const url = URL.createObjectURL(selectedPoster);
      setPosterPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPosterPreviewUrl(null);
    }
  }, [selectedPoster]);

  const onSubmit = (data: EventFormValues) => {
    startTransition(async () => {
      const tagsArray = data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
      
      const payload = { ...data, tags: tagsArray };

      if (demoMode) {
        // Do not persist in demo mode
        toast({
          title: 'Demo submission complete',
          description: 'This was a walkthrough only. No data was saved.',
        });
        onSuccess();
        return;
      }

      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Not signed in',
          description: 'Please sign in to submit or update events.',
        });
        return;
      }

      // Retrieve the current user's Firebase ID token for server authentication
      let idToken: string | undefined;
      try {
        const auth = getClientAuth();
        idToken = await auth.currentUser?.getIdToken();
      } catch (e) {
        console.error('Failed to get ID token', e);
      }

      const result = isEditMode
        ? await updateEventAction(eventToEdit.id, payload, idToken)
        : await addEventFromFormAction(payload, idToken);

      if (result.success) {
        toast({
          title: isEditMode ? 'Event Updated' : 'Event Added',
          description: result.message,
        });
        onSuccess();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
        {demoMode && (
          <div className="mb-2 rounded-md border border-dashed border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
            Demo mode — submissions here do not save data.
          </div>
        )}
        {!demoMode && isVenueRep && !isAdmin && (
          <div className="mb-2 rounded-md border border-dashed border-blue-300 bg-blue-50 text-blue-900 p-3 text-sm">
            Venue rep submissions require admin approval. New events will be marked <span className="font-semibold">Pending</span> and won't be publicly visible until approved.
            {isEditMode && eventToEdit?.status && (
              <div className="mt-1">
                Current status: <span className="font-semibold capitalize">{eventToEdit.status}</span>
              </div>
            )}
          </div>
        )}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="venueId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Venue</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger disabled={venueSelectDisabled}>
                        <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {displayVenues.map(venue => (
                        <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Event Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Play">Play</SelectItem>
                        <SelectItem value="Musical">Musical</SelectItem>
                        <SelectItem value="Improv">Improv</SelectItem>
                        <SelectItem value="Special Event">Special Event</SelectItem>
                        <SelectItem value="Audition">Audition</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Comedy, Drama, Family-Friendly" {...field} />
              </FormControl>
              <FormDescription>Separate tags with a comma.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Poster upload */}
        <div className="space-y-2">
          <FormLabel>Event Poster (Optional)</FormLabel>
          {posterPreviewUrl || form.watch('posterUrl') ? (
            <div className="flex items-start gap-4">
              <img
                src={posterPreviewUrl || form.watch('posterUrl') || ''}
                alt="Poster preview"
                className="h-32 w-24 object-cover rounded border"
              />
              <div className="flex-1 space-y-2">
                <div className="text-sm text-muted-foreground break-all">
                  {form.watch('posterUrl') ? `Saved URL: ${form.watch('posterUrl')}` : 'Local preview (not uploaded yet)'}
                </div>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={(e) => setSelectedPoster(e.target.files?.[0] || null)} />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isUploadingPoster || !selectedPoster || !form.getValues('venueId') || demoMode}
                    onClick={async () => {
                      if (!selectedPoster) return;
                      if (!form.getValues('venueId')) {
                        toast({ variant: 'destructive', title: 'Select a venue', description: 'Please select a venue before uploading a poster.' });
                        return;
                      }
                      setIsUploadingPoster(true);
                      try {
                        // Get ID token
                        let idToken: string | undefined;
                        try {
                          const auth = getClientAuth();
                          idToken = await auth.currentUser?.getIdToken();
                        } catch (e) {
                          console.error('Failed to get ID token', e);
                        }
                        const fd = new FormData();
                        fd.append('poster', selectedPoster);
                        fd.append('venueId', form.getValues('venueId'));
                        const res = await uploadEventPosterAction(fd, idToken);
                        if (res.success && res.url) {
                          form.setValue('posterUrl', res.url, { shouldDirty: true });
                          toast({ title: 'Poster uploaded', description: 'Your poster image has been uploaded.' });
                        } else {
                          toast({ variant: 'destructive', title: 'Upload failed', description: res.message || 'Unable to upload poster.' });
                        }
                      } finally {
                        setIsUploadingPoster(false);
                      }
                    }}
                  >
                    {isUploadingPoster && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Upload Poster
                  </Button>
                  {form.watch('posterUrl') && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => form.setValue('posterUrl', '', { shouldDirty: true })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input type="file" accept="image/*" onChange={(e) => setSelectedPoster(e.target.files?.[0] || null)} />
              <Button
                type="button"
                variant="secondary"
                disabled={isUploadingPoster || !selectedPoster || !form.getValues('venueId') || demoMode}
                onClick={async () => {
                  if (!selectedPoster) return;
                  if (!form.getValues('venueId')) {
                    toast({ variant: 'destructive', title: 'Select a venue', description: 'Please select a venue before uploading a poster.' });
                    return;
                  }
                  setIsUploadingPoster(true);
                  try {
                    let idToken: string | undefined;
                    try {
                      const auth = getClientAuth();
                      idToken = await auth.currentUser?.getIdToken();
                    } catch (e) {
                      console.error('Failed to get ID token', e);
                    }
                    const fd = new FormData();
                    fd.append('poster', selectedPoster);
                    fd.append('venueId', form.getValues('venueId'));
                    const res = await uploadEventPosterAction(fd, idToken);
                    if (res.success && res.url) {
                      form.setValue('posterUrl', res.url, { shouldDirty: true });
                      toast({ title: 'Poster uploaded', description: 'Your poster image has been uploaded.' });
                    } else {
                      toast({ variant: 'destructive', title: 'Upload failed', description: res.message || 'Unable to upload poster.' });
                    }
                  } finally {
                    setIsUploadingPoster(false);
                  }
                }}
              >
                {isUploadingPoster && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload Poster
              </Button>
            </div>
          )}
          <FormDescription>Upload an image to represent this event. JPG, PNG, GIF, or WEBP up to 10MB.</FormDescription>
          <FormField
            control={form.control}
            name="posterUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Poster URL (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormDescription>Alternatively, paste a URL if you already have one.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
            <FormLabel>Occurrences</FormLabel>
            <div className="space-y-2 pt-2">
                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                        <FormField
                            control={form.control}
                            name={`occurrences.${index}.date`}
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl><Input placeholder="YYYY-MM-DD" {...field} /></FormControl>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name={`occurrences.${index}.time`}
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl><Input placeholder="HH:mm" {...field} /></FormControl>
                                </FormItem>
                            )}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <XCircle className="h-5 w-5 text-destructive" />
                        </Button>
                    </div>
                ))}
                 <FormMessage>{form.formState.errors.occurrences?.message}</FormMessage>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ date: '', time: '' })}
                >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Occurrence
            </Button>
        </div>

         <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source URL (Optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel || (isEditMode ? 'Update Event' : 'Add Event')}
            </Button>
        </div>
      </form>
    </Form>
  );
}

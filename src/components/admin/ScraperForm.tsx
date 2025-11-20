'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { scrapeEventAction } from '@/lib/actions';
import { Loader2, Paperclip, ClipboardPaste } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Venue } from '@/lib/types';
import type { ScrapeEventDetailsOutput } from '@/ai/flows/scrape-event-details';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EventEditorForm } from '@/components/admin/EventEditorForm';
import { useAuth } from '@/components/auth/AuthProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const formSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal("")),
  screenshot: z.any()
    .refine((files) => files?.length == 1, "A screenshot image is required.")
    .refine((files) => files?.[0]?.type.startsWith("image/"), "Only image files are accepted."),
  model: z.string().optional(),
});

export function ScraperForm({ venues, onSuccess }: { venues: Venue[], onSuccess?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  
  const [prefillData, setPrefillData] = useState<(ScrapeEventDetailsOutput & { sourceUrl?: string }) | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [fileInputEl, setFileInputEl] = useState<HTMLInputElement | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: '', model: '' },
  });

  const screenshotFile = form.watch('screenshot');
  const fileName = screenshotFile?.[0]?.name;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const file = values.screenshot[0];
    const screenshotDataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    startTransition(async () => {
      const chosenModel = values.model && values.model.trim() ? values.model.trim() : undefined;
      const result = await scrapeEventAction(values.url || undefined, screenshotDataUri, chosenModel);
      if (result.success && result.data) {
        setPrefillData(result.data);
        setIsEditorOpen(true);

        // Admin-only: show how it was processed and any API cost/usage
        if (isAdmin && result.meta) {
          const processedBy = result.meta.processedBy === 'ai'
            ? (result.meta.model ? `AI (${result.meta.model})` : 'AI')
            : 'HTML extraction';
          let description = `Processed via ${processedBy}.`;
          if (result.meta.processedBy === 'ai') {
            const u = result.meta.usage || {};
            const parts: string[] = [];
            if (typeof u.inputTokens === 'number') parts.push(`input ${u.inputTokens}`);
            if (typeof u.outputTokens === 'number') parts.push(`output ${u.outputTokens}`);
            if (typeof u.totalTokens === 'number') parts.push(`total ${u.totalTokens}`);
            const hasUsage = parts.length > 0;
            if (hasUsage) description += ` Tokens: ${parts.join(', ')}.`;
            if (typeof result.meta.costUsd === 'number') {
              description += ` Estimated cost: $${result.meta.costUsd.toFixed(6)}.`;
            } else if (hasUsage) {
              description += ' Estimated cost unavailable (add pricing env vars).';
            } else {
              description += ' Token usage unavailable; cannot estimate cost.';
            }
          } else {
            description += ' No API cost.';
          }
          toast({ title: 'Processing details', description });
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Scraping failed',
          description: result.message,
        });
      }
    });
  };
  
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
                    description: "The screenshot has been added from your clipboard.",
                });
                break;
            }
        }
    }
  };

  const handleSkip = () => {
    // Open the editor without scraping. Use the URL (if provided) to prefill the source field.
    const sourceUrl = form.getValues('url') || '';
    setPrefillData({ sourceUrl });
    setIsEditorOpen(true);
  };


  return (
    <>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Event Source URL (Optional)</FormLabel>
                <FormControl>
                    <Input placeholder="https://example.com/events/the-new-play" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            
            <FormField
            control={form.control}
            name="screenshot"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Screenshot</FormLabel>
                    <div 
                      className="relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary/50"
                      onPaste={(e) => handlePaste(e, field.onChange)}
                      tabIndex={0}
                    >
                        <FormControl>
                          <Input 
                            type="file" 
                            accept="image/*"
                            className="sr-only"
                            ref={(e) => {
                                field.ref(e);
                                setFileInputEl(e);
                            }}
                            onChange={(e) => field.onChange(e.target.files)}
                          />
                        </FormControl>
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
                                onClick={() => fileInputEl?.click()}
                            >
                                Upload a File
                            </Button>
                        </div>
                    </div>
                    {fileName && (
                    <div className="flex items-center gap-2 mt-2 text-sm font-medium">
                        <Paperclip className="w-4 h-4" />
                        <span>{fileName}</span>
                    </div>
                    )}
                <FormMessage />
                </FormItem>
            )}
            />
            <div className="mt-2 flex items-center gap-3">
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Model (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                      <SelectTrigger className="w-[260px]">
                        <SelectValue placeholder="Use default model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="googleai/gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="googleai/gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                      <SelectItem value="openai/gpt-4o-mini">OpenAI GPT-4o mini</SelectItem>
                      <SelectItem value="openai/gpt-4o">OpenAI GPT-4o</SelectItem>
                      <SelectItem value="openai/gpt-5-nano">OpenAI GPT-5 nano</SelectItem>
                      <SelectItem value="openai/gpt-5-mini">OpenAI GPT-5 mini</SelectItem>
                      <SelectItem value="openai/gpt-5">OpenAI GPT-5</SelectItem>
                    </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending || !screenshotFile}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Scrape and Prefill Form
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="ml-2"
              onClick={handleSkip}
            >
              Skip image scrape
            </Button>
        </form>
        </Form>
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Review and Add Event</DialogTitle>
                    <DialogDescription>
                        Review and complete the event details. If you used image scraping, some fields may be pre-filled; otherwise, enter the information manually.
                    </DialogDescription>
                </DialogHeader>
                {prefillData && (
                    <EventEditorForm 
                        initialData={prefillData} 
                        venues={venues} 
                        onSuccess={() => {
                            setIsEditorOpen(false);
                            form.reset();
                            if (onSuccess) onSuccess();
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    </>
  );
}

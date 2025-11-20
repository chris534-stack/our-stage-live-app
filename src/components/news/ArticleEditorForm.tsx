
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect } from 'react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveNewsArticleAction } from '@/lib/actions';
import type { ScrapeArticleOutput } from '@/ai/flows/scrape-article';
import { Loader2 } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { getClientAuth } from '@/lib/firebase';

const articleFormSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  summary: z.string().min(10, 'Summary is required.'),
  url: z.string().url({ message: "A valid URL is required." }),
  imageUrl: z.string().url({ message: "Please enter a valid image URL." }).optional().or(z.literal("")),
});

type ArticleFormValues = z.infer<typeof articleFormSchema>;

interface ArticleEditorFormProps {
    initialData: ScrapeArticleOutput & { url: string };
    onSuccess: () => void;
}

export function ArticleEditorForm({ initialData, onSuccess }: ArticleEditorFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isImageError, setIsImageError] = useState(false);

  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: {
        title: toTitleCase(initialData.title) || '',
        summary: initialData.summary || '',
        url: initialData.url || '',
        imageUrl: initialData.imageUrl || '',
    },
  });

  const imageUrlValue = form.watch('imageUrl');

  useEffect(() => {
    setIsImageError(false);
  }, [imageUrlValue]);


  const onSubmit = (data: ArticleFormValues) => {
    startTransition(async () => {
      let idToken: string | undefined = undefined;
      try {
        idToken = (await getClientAuth().currentUser?.getIdToken()) || undefined;
      } catch (_) {
        // Non-fatal; server will attempt header-based auth as a fallback
      }
      const result = await saveNewsArticleAction(data, idToken);

      if (result.success) {
        toast({
          title: 'Article Added',
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
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary</FormLabel>
              <FormControl>
                <Textarea {...field} rows={5} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL (Optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {imageUrlValue && (
            <div className="space-y-2">
                <Label>Image Preview</Label>
                <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                    {!isImageError ? (
                        <Image
                            src={imageUrlValue}
                            alt="Article preview"
                            fill
                            className="object-cover"
                            data-ai-hint="news preview"
                            unoptimized
                            onError={() => setIsImageError(true)}
                        />
                    ) : (
                        <p className="text-muted-foreground text-sm px-4 text-center">
                            Image preview not available. Please check the URL.
                        </p>
                    )}
                </div>
            </div>
        )}

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Article Source URL</FormLabel>
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
            Save Article
            </Button>
        </div>
      </form>
    </Form>
  );
}

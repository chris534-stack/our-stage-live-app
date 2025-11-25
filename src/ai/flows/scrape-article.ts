
'use server';
/**
 * @fileOverview A Genkit flow that scrapes a news article from a URL.
 *
 * - scrapeArticle - A function that scrapes the article.
 * - ScrapeArticleInput - The input type for the scrapeArticle function.
 * - ScrapeArticleOutput - The return type for the scrapeArticle function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ScrapeArticleInputSchema = z.object({
    url: z.string().url().describe('The URL of the news article to scrape.'),
});
export type ScrapeArticleInput = z.infer<typeof ScrapeArticleInputSchema>;

const ScrapeArticleOutputSchema = z.object({
    title: z.string().describe('The main title of the article.'),
    summary: z.string().describe('A concise, one or two-sentence summary of the article content.'),
    imageUrl: z.string().optional().describe('The URL of the most relevant image from the article. This should be a direct link to an image file (e.g., .jpg, .png).'),
});
export type ScrapeArticleOutput = z.infer<typeof ScrapeArticleOutputSchema>;

export async function scrapeArticle(input: ScrapeArticleInput): Promise<ScrapeArticleOutput> {
    return scrapeArticleFlow(input);
}

import { extractArticleFromUrl } from '@/lib/html-extract';

const ScrapeArticlePromptInputSchema = z.object({
    url: z.string().url(),
    content: z.string().optional(),
    extractedTitle: z.string().optional(),
});

const scrapeArticlePrompt = ai.definePrompt({
    name: 'scrapeArticlePrompt',
    input: { schema: ScrapeArticlePromptInputSchema },
    output: { schema: ScrapeArticleOutputSchema },
    prompt: `You are an expert at extracting key information from online news articles and reviews.
    
URL: {{{url}}}

{{#if extractedTitle}}
Page Title: {{{extractedTitle}}}
{{/if}}

{{#if content}}
Below is the text content extracted from the page. Use this content to answer the questions.
---
{{{content}}}
---
{{else}}
(No content could be extracted directly. Please try to infer from the URL or any knowledge you have.)
{{/if}}

From the article, please extract the following information and provide it in a structured JSON format:

- **Title**: The main headline of the article.
- **Summary**: A brief, engaging summary of the article, about one to two sentences long.
- **Image URL**: Find the most prominent and relevant image in the article. Provide a direct URL to the image file (e.g., ending in .jpg, .png, .webp). If no suitable image is found, you can omit this field.`,
});

const scrapeArticleFlow = ai.defineFlow(
    {
        name: 'scrapeArticleFlow',
        inputSchema: ScrapeArticleInputSchema,
        outputSchema: ScrapeArticleOutputSchema,
    },
    async input => {
        // Fetch content server-side to simulate "browsing"
        const extracted = await extractArticleFromUrl(input.url);

        const promptInput = {
            url: input.url,
            content: extracted?.content,
            extractedTitle: extracted?.title,
        };

        const { output } = await scrapeArticlePrompt(promptInput);
        if (!output) {
            throw new Error('AI model did not return a valid output.');
        }

        // Fallback: if AI didn't find an image but our extractor did, use it
        if (!output.imageUrl && extracted?.imageUrl) {
            output.imageUrl = extracted.imageUrl;
        }

        return output;
    }
);

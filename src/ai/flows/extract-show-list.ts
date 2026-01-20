'use server';

/**
 * @fileOverview AI flow for extracting a list of shows from a screenshot of an archive page.
 * 
 * This is used when an admin pastes a screenshot of a theatre's archive/history page
 * and we need to extract the list of show titles for research.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractShowListInputSchema = z.object({
    screenshotDataUri: z.string().describe('A screenshot of an archive page as a Base64 data URI.'),
    venue: z.string().optional().describe('The known venue name for context.'),
});
export type ExtractShowListInput = z.infer<typeof ExtractShowListInputSchema>;

const ExtractShowListOutputSchema = z.object({
    shows: z.array(z.object({
        title: z.string().describe('The title of the show.'),
        year: z.number().optional().describe('The year of the production if visible.'),
        additionalContext: z.string().optional().describe('Any additional context like playwright, director, or season info.'),
    })).describe('List of shows extracted from the image.'),
    totalFound: z.number().describe('Total number of shows extracted.'),
    confidence: z.enum(['low', 'medium', 'high']).describe('Overall confidence in extraction quality.'),
    notes: z.string().optional().describe('Any notes about the extraction, e.g., if some items were unclear.'),
});
export type ExtractShowListOutput = z.infer<typeof ExtractShowListOutputSchema>;

const extractShowListPrompt = ai.definePrompt({
    name: 'extractShowListPrompt',
    input: { schema: ExtractShowListInputSchema },
    output: { schema: ExtractShowListOutputSchema },
    prompt: `You are an assistant helping to digitize theatre archive records for 'Our Stage, Eugene'.

Your task is to extract a list of shows/productions from this screenshot of a theatre's archive or history page.

{{media url=screenshotDataUri}}

{{#if venue}}
This is from the archives of: {{{venue}}}
{{/if}}

**Instructions:**

1. **Identify all show titles** visible in the image. These might be:
   - Listed in a table or list format
   - Part of a season announcement
   - Historical production records
   - Past performances listed on a website

2. **For each show, extract:**
   - **title**: The name of the production (properly formatted in Title Case)
   - **year**: The year it was performed (if visible)
   - **additionalContext**: Any other useful info like:
     - Playwright name (if shown)
     - Director name (if shown)
     - Season info (e.g., "Fall Season", "Anniversary Production")
     - Performance dates or month

3. **Rate your confidence:**
   - HIGH: Clear, legible text with obvious show titles
   - MEDIUM: Some text is unclear or format is ambiguous
   - LOW: Significant portions are unclear or interpretation required

4. **Notes**: If some entries were unclear or you had to make assumptions, note them.

**Tips:**
- Theatre shows are often formatted as "Title" or "Title by Playwright"
- Look for patterns like seasons, years, or date ranges
- Ignore promotional text, ticket info, or navigation elements
- Focus only on show/production titles

Return the structured JSON with all extracted shows.
`,
});

export async function extractShowListFromScreenshot(
    input: ExtractShowListInput
): Promise<{ output: ExtractShowListOutput }> {
    try {
        const resp: any = await extractShowListPrompt(input);
        const output = resp?.output as ExtractShowListOutput | undefined;

        if (!output) {
            throw new Error('AI model did not return a valid output.');
        }

        console.log('Extracted show list:', JSON.stringify(output, null, 2));

        return { output };
    } catch (e: any) {
        console.error('Error extracting show list:', e);
        throw new Error(`Failed to extract show list. Error: ${e?.message ?? e}`);
    }
}

'use server';

/**
 * @fileOverview AI flow for researching historical theatre productions for archive backfill.
 *
 * This flow takes show information (title, venue, year) and researches the production
 * to generate archive-appropriate descriptions and metadata.
 *
 * The descriptions are framed for historical archive viewing, not promotional content.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAllVenues } from '@/lib/data';

// --- Input/Output Schemas ---

const ArchiveResearchInputSchema = z.object({
    title: z.string().describe('The title of the show to research.'),
    venue: z.string().optional().describe('The theatre/venue where it was performed.'),
    year: z.number().optional().describe('The approximate year of the production.'),
    additionalContext: z.string().optional().describe('Any additional hints like playwright, director, etc.'),
});
export type ArchiveResearchInput = z.infer<typeof ArchiveResearchInputSchema>;

const ArchiveResearchPromptInputSchema = ArchiveResearchInputSchema.extend({
    knownVenues: z.string().describe('List of known venues to ground the research.'),
});

const ArchiveResearchOutputSchema = z.object({
    title: z.string().describe('The properly formatted title.'),
    reasoning: z.string().describe('Scratchpad for your research process. List specific characters, plot points, and confirmation of venue/year match here.'),
    description: z.string().describe('Archive-focused description (historical perspective, 2-4 sentences).'),
    type: z.enum(['Play', 'Musical', 'Improv', 'Special Event']).describe('The type of production.'),
    tags: z.array(z.string()).nullish().describe('Genre/theme tags like Drama, Comedy, Family-Friendly.'),
    playwright: z.string().nullish().describe('The playwright or book writer.'),
    composer: z.string().nullish().describe('The composer (for musicals).'),
    director: z.string().nullish().describe('The director if known.'),
    synopsis: z.string().nullish().describe('Brief plot summary (spoiler-free).'),
    historicalContext: z.string().nullish().describe('Why this production mattered for Eugene\'s theatre scene.'),
    researchConfidence: z.enum(['low', 'medium', 'high']).describe('Confidence level in the research accuracy.'),
    sources: z.array(z.string()).nullish().describe('URLs or references where information was found.'),
    originalYear: z.number().nullish().describe('Year of the original production if different from performance year.'),
    dateStart: z.string().nullish().describe('ISO date string (YYYY-MM-DD) of the opening night or the earliest known date.'),
    dateEnd: z.string().nullish().describe('ISO date string (YYYY-MM-DD) of the closing night.'),
});
export type ArchiveResearchOutput = z.infer<typeof ArchiveResearchOutputSchema>;

// --- Batch Input/Output ---

const ArchiveResearchBatchInputSchema = z.object({
    shows: z.array(ArchiveResearchInputSchema).describe('List of shows to research.'),
    defaultVenueId: z.string().optional().describe('Default venue ID for all shows in batch.'),
});
export type ArchiveResearchBatchInput = z.infer<typeof ArchiveResearchBatchInputSchema>;

const ArchiveResearchBatchOutputSchema = z.object({
    results: z.array(z.object({
        input: ArchiveResearchInputSchema,
        output: ArchiveResearchOutputSchema.optional(),
        error: z.string().optional(),
    })).describe('Research results for each show.'),
    totalProcessed: z.number(),
    successCount: z.number(),
    failureCount: z.number(),
});
export type ArchiveResearchBatchOutput = z.infer<typeof ArchiveResearchBatchOutputSchema>;

// --- Usage Metadata ---

export type ArchiveResearchUsage = {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
};

export type ArchiveResearchMeta = {
    model?: string;
    usage?: ArchiveResearchUsage;
};

// --- Tool for venue lookup ---

const getKnownVenuesTool = ai.defineTool({
    name: 'getKnownVenuesForArchive',
    description: 'Gets a list of all known theatre venues in Eugene that the website tracks.',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({
        id: z.string(),
        name: z.string(),
    })).describe('An array of venue objects with id and name.'),
}, async () => {
    const venues = await getAllVenues();
    return venues.map(v => ({ id: v.id, name: v.name }));
});

// --- Main Research Prompt ---

// --- Main Research Prompt ---

// --- Main Research Prompt ---

const archiveResearchPrompt = ai.definePrompt({
    name: 'archiveResearchPrompt',
    input: { schema: ArchiveResearchPromptInputSchema },
    output: { schema: ArchiveResearchOutputSchema },
    prompt: `You are a theatre historian assistant for 'Our Stage, Eugene', a community theatre archive.

Your task is to research a theatre production and provide **specific, detailed** information.

**The Goal:**
We need to know what THIS specific show is about. **Avoid generic "barnum statements"** (e.g., "A play exploring human relationships"). Instead, tell us about the specific characters, the central conflict, and the unique hook of the story.

**Show to Research:**
- Title: {{{title}}}
{{#if venue}}- Venue: {{{venue}}}{{/if}}
{{#if year}}- Year: {{year}}{{/if}}
{{#if additionalContext}}- Additional Context: {{{additionalContext}}}{{/if}}

**Known Venues in Eugene:**
{{knownVenues}}

**Instructions:**

1. **Phase 1: Reasoning (Internal Monologue)**
   - In the \`reasoning\` field, you MUST first list:
     - The Author/Playwright.
     - The Names of the Main Characters.
     - The Central Conflict or Plot Driver.
     - Verification of the Venue/Year (Does the venue match one of the Known Venues? Did it exist then?).
     - **Dates**: Look for specific month/day if possible (e.g. "Run: May 5-20").
   - If you cannot find specific character names or plot points, acknowledge this and set confidence to LOW.

2. **Phase 2: Specific Synopsis**
   - Use the details from your reasoning to write a synopsis that "paints a picture."
   - Mention the central dilemma.
   - Example (Good): "A father realizes he abandoned his artistic dreams for a corporate paycheck and sees his son making the same mistake."
   - Example (Bad): "A story about family dynamics and career choices."

3. **Phase 3: Archive Description**
   - Frame the synopis historically (past tense) for the main description.
   - "The Very Little Theatre presented Philip Barry's drama about the tension between art and commerce..." relative to the specific production year.

4. **Phase 4: Metadata & Dates**
   - **Dates**: If you found the specific run dates, fill in \`dateStart\` and \`dateEnd\` (YYYY-MM-DD). If you only know the month, use the 1st and last day of that month.
   - **Confidence**:
     - **HIGH**: You found the specific production or are very familiar with it.
     - **MEDIUM**: You found the play but are unsure if this specific local production is that play (e.g. title ambiguity).
     - **LOW**: You are guessing based on "vibes" alone.

**Rule of Thumb:** Specificity = High Confidence. Vague = Low Confidence.

Return the structured JSON output.
`,
});

// --- Main Research Function ---

export async function researchArchiveShow(
    input: ArchiveResearchInput
): Promise<{ output: ArchiveResearchOutput; meta?: ArchiveResearchMeta }> {
    try {
        const venues = await getAllVenues();
        const knownVenues = venues.map(v => v.name).join(', ');

        const resp: any = await archiveResearchPrompt({
            ...input,
            knownVenues
        });
        const output = resp?.output as ArchiveResearchOutput | undefined;

        // Extract usage metadata
        const usageRaw = resp?.response?.usageMetadata ?? resp?.usage ?? resp?.usageMetadata;
        const usage: ArchiveResearchUsage | undefined = usageRaw
            ? {
                inputTokens: usageRaw.promptTokenCount ?? usageRaw.inputTokens,
                outputTokens: usageRaw.candidatesTokenCount ?? usageRaw.outputTokens,
                totalTokens:
                    usageRaw.totalTokenCount ??
                    ((usageRaw.inputTokens ?? 0) + (usageRaw.outputTokens ?? 0)),
            }
            : undefined;
        const model = resp?.response?.model ?? resp?.model ?? undefined;

        if (!output) {
            throw new Error(
                'AI model did not return a valid output. The response may have been empty or blocked by safety settings.'
            );
        }

        const meta: ArchiveResearchMeta | undefined = (usage || model) ? { model, usage } : undefined;

        return { output, meta };
    } catch (e: any) {
        console.error('Error in researchArchiveShow:', e);
        throw new Error(`Archive research failed. Raw error: ${e?.message ?? e}`);
    }
}

// --- Batch Research Function ---

export async function researchArchiveShowBatch(
    input: ArchiveResearchBatchInput
): Promise<{ output: ArchiveResearchBatchOutput; totalMeta?: ArchiveResearchMeta }> {
    const results: ArchiveResearchBatchOutput['results'] = [];
    let successCount = 0;
    let failureCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const show of input.shows) {
        try {
            const { output, meta } = await researchArchiveShow(show);
            results.push({ input: show, output });
            successCount++;

            if (meta?.usage) {
                totalInputTokens += meta.usage.inputTokens ?? 0;
                totalOutputTokens += meta.usage.outputTokens ?? 0;
            }
        } catch (error: any) {
            results.push({
                input: show,
                error: error?.message ?? 'Unknown error occurred',
            });
            failureCount++;
        }
    }

    const output: ArchiveResearchBatchOutput = {
        results,
        totalProcessed: input.shows.length,
        successCount,
        failureCount,
    };

    const totalMeta: ArchiveResearchMeta = {
        usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
        },
    };

    return { output, totalMeta };
}

// --- Parse Show List Function ---

/**
 * Parses a raw text list of shows into structured input objects.
 * Supports various formats:
 * - "Show Title (2019)"
 * - "Show Title - 2019"
 * - "Show Title"
 * - "Show Title by Playwright Name"
 */
export async function parseShowList(rawText: string): Promise<ArchiveResearchInput[]> {
    const lines = rawText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

    return lines.map(line => {
        // Try to extract year from various formats
        const yearMatch = line.match(/\((\d{4})\)|\s*-\s*(\d{4})|\s+(\d{4})$/);
        const year = yearMatch
            ? parseInt(yearMatch[1] || yearMatch[2] || yearMatch[3], 10)
            : undefined;

        // Remove year from title
        let title = line
            .replace(/\(\d{4}\)/, '')
            .replace(/\s*-\s*\d{4}$/, '')
            .replace(/\s+\d{4}$/, '')
            .trim();

        // Try to extract playwright from "by" format
        let additionalContext: string | undefined;
        const byMatch = title.match(/\s+by\s+(.+)$/i);
        if (byMatch) {
            additionalContext = `Playwright: ${byMatch[1]}`;
            title = title.replace(/\s+by\s+.+$/i, '').trim();
        }

        return {
            title,
            year,
            additionalContext,
        };
    });
}

// --- Genkit Flow Definition (optional, for dev UI) ---

const archiveResearchFlow = ai.defineFlow(
    {
        name: 'archiveResearchFlow',
        inputSchema: ArchiveResearchInputSchema,
        outputSchema: ArchiveResearchOutputSchema,
    },
    async (input) => {
        const { output } = await researchArchiveShow(input);
        return output;
    }
);

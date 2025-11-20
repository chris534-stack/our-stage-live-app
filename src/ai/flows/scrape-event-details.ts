
'use server';

/**
 * @fileOverview This file defines a Genkit flow for automatically extracting event details from a user-provided screenshot.
 *
 * It uses a combination of web scraping and AI to extract information about events from various sources.
 * The flow takes a URL and a screenshot data URI as input and returns a structured object containing event details.
 *
 * @file scrapeEventDetails - A function that scrapes event details from a given URL and screenshot.
 * @file ScrapeEventDetailsInput - The input type for the scrapeEventDetails function.
 * @file ScrapeEventDetailsOutput - The output type for the scrapeEventDetails function, containing event details.
 */

import {ai, getAi} from '@/ai/genkit';
import {z} from 'zod';
import { getAllVenues } from '@/lib/data';

const ScrapeEventDetailsInputSchema = z.object({
  url: z.string().url().optional().describe('The URL of the event page to scrape.'),
  screenshotDataUri: z.string().describe("A screenshot of the page as a Base64 data URI."),
});
export type ScrapeEventDetailsInput = z.infer<typeof ScrapeEventDetailsInputSchema>;

const ScrapeEventDetailsOutputSchema = z.object({
  title: z.string().optional().describe('The title of the event.'),
  occurrences: z.array(z.object({
      date: z.string().describe("The date of the performance in YYYY-MM-DD format."),
      time: z.string().optional().describe("The time of the performance in HH:mm 24-hour format. Omit if not specified."),
  })).optional().describe('A list of all dates and times for the event performances. Only include performances that have not yet occurred.'),
  venue: z.string().nullable().optional().describe('The venue of the event. Must match a name from the getKnownVenues tool.'),
  description: z.string().optional().describe('A detailed description of the event.'),
  tags: z.array(z.string()).optional().describe("A list of relevant tags or categories for the event, such as 'Comedy', 'Drama', 'Family-Friendly', 'Improv', 'Workshop', 'Concert'.")
});
export type ScrapeEventDetailsOutput = z.infer<typeof ScrapeEventDetailsOutputSchema>;

// Expose minimal usage metadata so callers can compute cost externally.
export type ScrapeEventUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};
export type ScrapeEventMeta = {
  model?: string;
  usage?: ScrapeEventUsage;
};

// Note: We call the prompt directly here (instead of the flow wrapper) so we can
// access provider-specific metadata that may be present on the raw response.
export async function scrapeEventDetails(
  input: ScrapeEventDetailsInput,
  modelOverride?: string
): Promise<{ output: ScrapeEventDetailsOutput; meta?: ScrapeEventMeta }> {
  try {
    // If a model override is specified, construct prompts on a per-call AI instance.
    if (modelOverride) {
      const ai2 = getAi(modelOverride);
      const getKnownVenuesTool2 = ai2.defineTool({
        name: 'getKnownVenues',
        description: 'Gets a list of all known theatre venues that the website tracks.',
        inputSchema: z.object({}),
        outputSchema: z.array(z.string()).describe('An array of known venue names.'),
      }, async () => {
        const venues = await getAllVenues();
        return venues.map(v => v.name);
      });
      const scrapeEventDetailsPrompt2 = ai2.definePrompt({
        name: 'scrapeEventDetailsPrompt',
        input: {schema: ScrapeEventDetailsInputSchema},
        output: {schema: ScrapeEventDetailsOutputSchema},
        tools: [getKnownVenuesTool2],
        prompt: `You are an expert assistant for the 'Our Stage, Eugene' website. Your task is to analyze an image provided by an administrator and extract event details into a structured JSON format.

Here is the image to analyze:
{{media url=screenshotDataUri}}

{{#if url}}
The image is a screenshot from the following URL: {{url}}
{{/if}}

Please answer the following questions based on the image and provide your final answer as a single JSON object.

- **What is the title of the event?** If this is for an audition, the title should be the name of the show they are auditioning for. Format the title in Title Case (e.g., 'LIZZIE THE MUSICAL' should become 'Lizzie the Musical').

- **What is the venue for this event?** To answer this, you MUST first call the \`getKnownVenues\` tool to get a list of approved theatre names. Then, compare the names from the tool with the text in the image. The venue you provide in the JSON must be an *exact, case-sensitive match* from the tool's list. IMPORTANT: Even if you cannot find a matching venue and must set the 'venue' field to null, you must still extract all other details like the title, description, and dates.

- **What are the dates and times of the performances or auditions?**
  - Only include dates that are in the future. If a year isn't specified, assume the current year.
  - If the image indicates a run period (e.g., "Runs Mar 27 – Apr 12, 2026") but does NOT specify a detailed schedule, assume a standard theatre run on Fridays, Saturdays, and Sundays within that range.
  - Default times when using this assumption: Fridays 19:30, Saturdays 19:30, Sundays 14:00. If explicit times are shown in the image, prefer those instead of the defaults.
  - Generate each individual performance occurrence (one per performance date) using the assumed or explicit schedule.
  - Apply this assumption only when the event is clearly a theatre production run. If it is an audition, workshop, concert, or other non-run event, do not assume extra dates; only output what is explicitly provided.
  - Provide times in 24-hour HH:mm format when known. If a specific performance time is not known and no default applies, omit the time field for that occurrence.
  - If no upcoming dates are found, return an empty array for this field.

- **What are the tags for this event?** Extract relevant tags or categories like 'Comedy', 'Drama', 'Family-Friendly', 'Improv', 'Workshop', or 'Concert'.

- **What is the description of the event?** Provide a detailed summary. If it's an audition, please make that clear in the description.

Remember, your final output must be only the JSON object with the extracted details.
        `,
      });
      const EnhanceSynopsisInputSchema2 = z.object({
        url: z.string().url().optional(),
        screenshotDataUri: z.string(),
        title: z.string().optional(),
        venue: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
      });
      const EnhanceSynopsisOutputSchema2 = z.object({
        description: z.string().describe('A concise, spoiler-free synopsis (2-4 sentences) suitable for an event listing.'),
      });
      const enhanceSynopsisPrompt2 = ai2.definePrompt({
        name: 'enhanceSynopsisPrompt',
        input: { schema: EnhanceSynopsisInputSchema2 },
        output: { schema: EnhanceSynopsisOutputSchema2 },
        prompt: `You are helping fill missing details for an event listing on the 'Our Stage, Eugene' website.

If the original description is missing or too short, write a friendly, spoiler-free synopsis based on what you can infer
from the provided context.

Context you may use:
- Title: {{{title}}}
- Venue: {{{venue}}}
- Tags: {{#each tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Source URL: {{#if url}}{{{url}}}{{else}}(none){{/if}}

You may also inspect the screenshot for additional signals about tone or genre:
{{media url=screenshotDataUri}}

Guidelines:
- 2-4 sentences.
- No plot spoilers; focus on vibe, themes, and what audiences can expect.
- Neutral, inclusive tone suitable for broad audiences.
Return only the JSON response defined by the schema.
        `,
      });

      const resp2: any = await scrapeEventDetailsPrompt2(input);
      let output = resp2?.output as ScrapeEventDetailsOutput | undefined;
      const usageRaw1b = resp2?.response?.usageMetadata ?? resp2?.usage ?? resp2?.usageMetadata;
      let usage: ScrapeEventUsage | undefined = usageRaw1b
        ? {
            inputTokens: usageRaw1b.promptTokenCount ?? usageRaw1b.inputTokens,
            outputTokens: usageRaw1b.candidatesTokenCount ?? usageRaw1b.outputTokens,
            totalTokens:
              usageRaw1b.totalTokenCount ??
              ((usageRaw1b.inputTokens ?? 0) + (usageRaw1b.outputTokens ?? 0)),
          }
        : undefined;
      const model = resp2?.response?.model ?? resp2?.model ?? modelOverride;

      if (!output) {
        throw new Error(
          'AI model did not return a valid output. The response may have been empty or blocked by safety settings.'
        );
      }

      const needsSynopsis = !output.description || output.description.trim().length < 80;
      if (needsSynopsis) {
        try {
          const enhanceInput = {
            url: input.url,
            screenshotDataUri: input.screenshotDataUri,
            title: output.title,
            venue: output.venue ?? null,
            tags: output.tags || [],
          } as any;
          const synResp2: any = await enhanceSynopsisPrompt2(enhanceInput);
          const synOut2 = synResp2?.output as { description?: string } | undefined;
          if (synOut2?.description) {
            output = { ...output, description: synOut2.description };
          }
          const usageRaw2b = synResp2?.response?.usageMetadata ?? synResp2?.usage ?? synResp2?.usageMetadata;
          if (usageRaw2b) {
            const addIn = usageRaw2b.promptTokenCount ?? usageRaw2b.inputTokens ?? 0;
            const addOut = usageRaw2b.candidatesTokenCount ?? usageRaw2b.outputTokens ?? 0;
            usage = {
              inputTokens: (usage?.inputTokens ?? 0) + addIn,
              outputTokens: (usage?.outputTokens ?? 0) + addOut,
              totalTokens:
                (usage?.totalTokens ?? ((usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0))) +
                (usageRaw2b.totalTokenCount ?? (addIn + addOut)),
            };
          }
        } catch (e) {
          try { console.warn('Enhance synopsis step failed (non-fatal):', e); } catch {}
        }
      }

      const meta2: ScrapeEventMeta | undefined = (usage || model) ? { model, usage } : undefined;
      try {
        console.log('AI Model Output:', JSON.stringify(output, null, 2));
        if (meta2?.usage) console.log('AI Usage:', JSON.stringify(meta2.usage));
      } catch {}
      return { output, meta: meta2 };
    }

    // Default path: use the module-level prompts/ai
    const resp: any = await scrapeEventDetailsPrompt(input);
    let output = resp?.output as ScrapeEventDetailsOutput | undefined;

    // Attempt to extract token usage and model info if available (call #1).
    const usageRaw1 = resp?.response?.usageMetadata ?? resp?.usage ?? resp?.usageMetadata;
    let usage: ScrapeEventUsage | undefined = usageRaw1
      ? {
          inputTokens: usageRaw1.promptTokenCount ?? usageRaw1.inputTokens,
          outputTokens: usageRaw1.candidatesTokenCount ?? usageRaw1.outputTokens,
          totalTokens:
            usageRaw1.totalTokenCount ??
            ((usageRaw1.inputTokens ?? 0) + (usageRaw1.outputTokens ?? 0)),
        }
      : undefined;
    const model = resp?.response?.model ?? resp?.model ?? undefined;

    if (!output) {
      throw new Error(
        'AI model did not return a valid output. The response may have been empty or blocked by safety settings.'
      );
    }

    // Optional enhancement: if description is missing or too short, generate a spoiler-free synopsis
    const needsSynopsis = !output.description || output.description.trim().length < 80;
    if (needsSynopsis) {
      try {
        const enhanceInput: EnhanceSynopsisInput = {
          url: input.url,
          screenshotDataUri: input.screenshotDataUri,
          title: output.title,
          venue: output.venue ?? null,
          tags: output.tags || [],
        };
        const synResp: any = await enhanceSynopsisPrompt(enhanceInput);
        const synOut = synResp?.output as EnhanceSynopsisOutput | undefined;
        if (synOut?.description) {
          output = { ...output, description: synOut.description };
        }
        // Aggregate usage from call #2
        const usageRaw2 = synResp?.response?.usageMetadata ?? synResp?.usage ?? synResp?.usageMetadata;
        if (usageRaw2) {
          const addIn = usageRaw2.promptTokenCount ?? usageRaw2.inputTokens ?? 0;
          const addOut = usageRaw2.candidatesTokenCount ?? usageRaw2.outputTokens ?? 0;
          usage = {
            inputTokens: (usage?.inputTokens ?? 0) + addIn,
            outputTokens: (usage?.outputTokens ?? 0) + addOut,
            totalTokens:
              (usage?.totalTokens ?? ((usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0))) +
              (usageRaw2.totalTokenCount ?? (addIn + addOut)),
          };
        }
      } catch (e) {
        // Non-fatal; keep original output if enhancement fails
        try { console.warn('Enhance synopsis step failed (non-fatal):', e); } catch {}
      }
    }

    const meta: ScrapeEventMeta | undefined = (usage || model) ? { model, usage } : undefined;

    // Helpful debug log
    try {
      // eslint-disable-next-line no-console
      console.log('AI Model Output:', JSON.stringify(output, null, 2));
      if (meta?.usage) {
        // eslint-disable-next-line no-console
        console.log('AI Usage:', JSON.stringify(meta.usage));
      }
    } catch {}

    return { output, meta };
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('Error calling scrapeEventDetailsPrompt:', e);
    throw new Error(`The AI model failed to process the request. Raw error: ${e?.message ?? e}`);
  }
}

const getKnownVenuesTool = ai.defineTool({
  name: 'getKnownVenues',
  description: 'Gets a list of all known theatre venues that the website tracks.',
  inputSchema: z.object({}),
  outputSchema: z.array(z.string()).describe('An array of known venue names.'),
}, async () => {
  const venues = await getAllVenues();
  return venues.map(v => v.name);
});

const scrapeEventDetailsPrompt = ai.definePrompt({
  name: 'scrapeEventDetailsPrompt',
  input: {schema: ScrapeEventDetailsInputSchema},
  output: {schema: ScrapeEventDetailsOutputSchema},
  tools: [getKnownVenuesTool],
  prompt: `You are an expert assistant for the 'Our Stage, Eugene' website. Your task is to analyze an image provided by an administrator and extract event details into a structured JSON format.

Here is the image to analyze:
{{media url=screenshotDataUri}}

{{#if url}}
The image is a screenshot from the following URL: {{url}}
{{/if}}

Please answer the following questions based on the image and provide your final answer as a single JSON object.

- **What is the title of the event?** If this is for an audition, the title should be the name of the show they are auditioning for. Format the title in Title Case (e.g., 'LIZZIE THE MUSICAL' should become 'Lizzie the Musical').

- **What is the venue for this event?** To answer this, you MUST first call the \`getKnownVenues\` tool to get a list of approved theatre names. Then, compare the names from the tool with the text in the image. The venue you provide in the JSON must be an *exact, case-sensitive match* from the tool's list. IMPORTANT: Even if you cannot find a matching venue and must set the 'venue' field to null, you must still extract all other details like the title, description, and dates.

- **What are the dates and times of the performances or auditions?**
  - Only include dates that are in the future. If a year isn't specified, assume the current year.
  - If the image indicates a run period (e.g., "Runs Mar 27 – Apr 12, 2026") but does NOT specify a detailed schedule, assume a standard theatre run on Fridays, Saturdays, and Sundays within that range.
  - Default times when using this assumption: Fridays 19:30, Saturdays 19:30, Sundays 14:00. If explicit times are shown in the image, prefer those instead of the defaults.
  - Generate each individual performance occurrence (one per performance date) using the assumed or explicit schedule.
  - Apply this assumption only when the event is clearly a theatre production run. If it is an audition, workshop, concert, or other non-run event, do not assume extra dates; only output what is explicitly provided.
  - Provide times in 24-hour HH:mm format when known. If a specific performance time is not known and no default applies, omit the time field for that occurrence.
  - If no upcoming dates are found, return an empty array for this field.

- **What are the tags for this event?** Extract relevant tags or categories like 'Comedy', 'Drama', 'Family-Friendly', 'Improv', 'Workshop', or 'Concert'.

- **What is the description of the event?** Provide a detailed summary. If it's an audition, please make that clear in the description.

Remember, your final output must be only the JSON object with the extracted details.
  `,
});

const EnhanceSynopsisInputSchema = z.object({
  url: z.string().url().optional(),
  screenshotDataUri: z.string(),
  title: z.string().optional(),
  venue: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});
type EnhanceSynopsisInput = z.infer<typeof EnhanceSynopsisInputSchema>;

const EnhanceSynopsisOutputSchema = z.object({
  description: z.string().describe('A concise, spoiler-free synopsis (2-4 sentences) suitable for an event listing.'),
});
type EnhanceSynopsisOutput = z.infer<typeof EnhanceSynopsisOutputSchema>;

const enhanceSynopsisPrompt = ai.definePrompt({
  name: 'enhanceSynopsisPrompt',
  input: { schema: EnhanceSynopsisInputSchema },
  output: { schema: EnhanceSynopsisOutputSchema },
  prompt: `You are helping fill missing details for an event listing on the 'Our Stage, Eugene' website.

If the original description is missing or too short, write a friendly, spoiler-free synopsis based on what you can infer
from the provided context.

Context you may use:
- Title: {{{title}}}
- Venue: {{{venue}}}
- Tags: {{#each tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Source URL: {{#if url}}{{{url}}}{{else}}(none){{/if}}

You may also inspect the screenshot for additional signals about tone or genre:
{{media url=screenshotDataUri}}

Guidelines:
- 2-4 sentences.
- No plot spoilers; focus on vibe, themes, and what audiences can expect.
- Neutral, inclusive tone suitable for broad audiences.
Return only the JSON response defined by the schema.
`,
});

const scrapeEventDetailsFlow = ai.defineFlow(
  {
    name: 'scrapeEventDetailsFlow',
    inputSchema: ScrapeEventDetailsInputSchema,
    outputSchema: ScrapeEventDetailsOutputSchema,
  },
  async (input) => {
    try {
        const {output} = await scrapeEventDetailsPrompt(input);
        
        console.log('AI Model Response:', JSON.stringify(output, null, 2));
        
        if (!output) {
          throw new Error('AI model did not return a valid output. The response may have been empty or blocked by safety settings.');
        }

        return output;
    } catch (e: any) {
        console.error("Error calling scrapeEventDetailsPrompt:", e);
        throw new Error(`The AI model failed to process the request. Raw error: ${e.message}`);
    }
  }
);

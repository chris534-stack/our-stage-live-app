import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { createRequire } from 'node:module';

// Allow selecting the model via env for easy provider/model swaps.
// Example: AI_MODEL=googleai/gemini-1.5-pro or AI_MODEL=openai/gpt-4o-mini
const DEFAULT_MODEL = 'googleai/gemini-3-flash-preview';
const ENV_MODEL = process.env.AI_MODEL || DEFAULT_MODEL;

export function getAi(modelOverride?: string) {
  const model = modelOverride || ENV_MODEL;
  const plugins: any[] = [];
  if (model.startsWith('googleai/')) {
    plugins.push(googleAI({ apiKey: process.env.GEMINI_API_KEY }));
  }
  if (model.startsWith('openai/')) {
    try {
      const require = createRequire(import.meta.url);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@genkit-ai/compat-oai/openai');
      const openAI = (mod && (mod.openAI || mod.default)) || mod;
      plugins.push(openAI({ apiKey: process.env.OPENAI_API_KEY }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('OpenAI plugin not installed. Run: npm i @genkit-ai/compat-oai');
    }
  }
  return genkit({ plugins, model });
}

export const ai = getAi();

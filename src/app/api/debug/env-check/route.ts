import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  // Never return secret values. Only booleans and minimal metadata.
  const aiModel = process.env.AI_MODEL || null;
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  return NextResponse.json(
    {
      ok: true,
      aiModel,
      hasOpenAIKey,
      hasGeminiKey,
      nodeEnv: process.env.NODE_ENV || null,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

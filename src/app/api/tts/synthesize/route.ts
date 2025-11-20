/**
 * TTS Synthesis API Route
 * Generates speech using Gemini 2.5 Pro TTS with Firestore caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateGeminiTTSWithMetadata, getGeminiTTSVoiceById, GeminiTTSVoice } from '@/lib/gemini-tts-correct';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    console.log('[TTS API] Request received');
    
    const body = await request.json();
    const { text, voiceId, showId, characterName, speakers } = body;

    console.log('[TTS API] Request body:', { text: text?.substring(0, 50), voiceId, showId, characterName });

    if (!text || !voiceId) {
      console.error('[TTS API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: text, voiceId' },
        { status: 400 }
      );
    }

    // Check if API key is available
    const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error('[TTS API] GOOGLE_API_KEY (or GEMINI_API_KEY) not found in environment');
      return NextResponse.json(
        { error: 'Server configuration error: Missing API key' },
        { status: 500 }
      );
    }

    // Get voice configuration
    const voice = getGeminiTTSVoiceById(voiceId);
    if (!voice) {
      return NextResponse.json(
        { error: `Voice not found: ${voiceId}` },
        { status: 404 }
      );
    }

    // Generate speech with Gemini 2.5 Pro
    console.log('[TTS] Generating speech with Gemini 2.5 Pro:', { text: text.substring(0, 50), voiceId });
    
    const multiSpeakerVoices = Array.isArray(speakers)
      ? speakers.reduce<Array<{ speaker: string; voice: GeminiTTSVoice }>>((acc, config: { name?: string; voiceId?: string }) => {
          const speakerName = (config.name || '').trim();
          const speakerVoiceId = config.voiceId || '';
          if (!speakerName || !speakerVoiceId) {
            return acc;
          }

          const resolvedVoice = getGeminiTTSVoiceById(speakerVoiceId);
          if (!resolvedVoice) {
            console.warn('[TTS] Unknown speaker voiceId, skipping', {
              speakerName,
              speakerVoiceId,
            });
            return acc;
          }

          acc.push({
            speaker: speakerName,
            voice: resolvedVoice,
          });
          return acc;
        }, [])
      : [];

    const result = await generateGeminiTTSWithMetadata(text, voice, {
      multiSpeakers: multiSpeakerVoices,
    });
    
    // Convert buffer to base64 data URL for immediate playback
    const base64Audio = result.audioBuffer.toString('base64');
    const mimeType = result.mimeType || 'audio/mpeg';
    const audioUrl = `data:${mimeType};base64,${base64Audio}`;
    
    console.log('[TTS] Audio generated:', { 
      size: result.audioBuffer.length,
      mimeType,
      cost: result.cost?.totalCost 
    });
    
    // Estimate duration (rough: 150 words per minute, 5 chars per word)
    const estimatedDuration = (text.length / 5 / 150) * 60;
    
    return NextResponse.json({
      audioUrl,
      cached: false,
      duration: estimatedDuration,
      fileSize: result.audioBuffer.length,
      cost: result.cost,
    });
    
  } catch (error) {
    console.error('[TTS] Error:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate speech', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

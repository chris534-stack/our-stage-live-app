/**
 * Text-to-Speech Hook for Rehearse Feature
 * Uses Gemini 2.5 Pro TTS with caching
 */

import { useEffect, useRef, useState } from 'react';

export interface TTSOptions {
  text: string;
  voiceId?: string;
  showId?: string;
  characterName?: string;
  speakers?: Array<{
    name: string;
    voiceId: string;
    description?: string;
  }>;
}

export interface GenerateSpeechConfig {
  background?: boolean;
}

export interface TTSResult {
  audioUrl: string;
  cached: boolean;
  duration: number;
  mimeType?: string;
  fileSize?: number;
  cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  rawAudioUrl?: string;
}

export function useTextToSpeech() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanupObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupObjectUrl();
    };
  }, []);

  const generateSpeech = async (
    options: TTSOptions,
    config: GenerateSpeechConfig = {}
  ): Promise<TTSResult | null> => {
    const { background = false } = config;

    if (!background) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: options.text,
          voiceId: options.voiceId || 'young_male_hero', // Default voice
          showId: options.showId,
          characterName: options.characterName,
          speakers: options.speakers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }

      const result = await response.json();

      const {
        audioUrl: rawAudioUrl,
        mimeType,
        cached = false,
        duration = 0,
        fileSize,
        cost,
      } = result as {
        audioUrl: string;
        mimeType?: string;
        cached?: boolean;
        duration?: number;
        fileSize?: number;
        cost?: TTSResult['cost'];
      };

      if (!rawAudioUrl) {
        throw new Error('TTS response missing audio data');
      }

      let playableUrl = rawAudioUrl as string;
      let resolvedMimeType = mimeType;
      let newObjectUrl: string | null = null;

      if (rawAudioUrl.startsWith('data:')) {
        try {
          const commaIndex = rawAudioUrl.indexOf(',');
          if (commaIndex !== -1) {
            const header = rawAudioUrl.slice(0, commaIndex);
            const base64Part = rawAudioUrl.slice(commaIndex + 1).replace(/\s/g, '');

            const mimeMatch = header.match(/^data:([^;]+);base64$/i);
            if (!resolvedMimeType && mimeMatch?.[1]) {
              resolvedMimeType = mimeMatch[1];
            }

            const binaryString = typeof atob === 'function' ? atob(base64Part) : Buffer.from(base64Part, 'base64').toString('binary');
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i += 1) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const blob = new Blob([bytes], { type: resolvedMimeType || (mimeMatch?.[1] ?? 'audio/mpeg') });
            newObjectUrl = URL.createObjectURL(blob);
          }
        } catch (blobError) {
          console.warn('[TTS] Failed to create blob from data URL', blobError);
        }
      }

      if (newObjectUrl) {
        cleanupObjectUrl();
        objectUrlRef.current = newObjectUrl;
        playableUrl = newObjectUrl;
      } else {
        // If we couldn't create an object URL, keep original data URL but
        // ensure any prior object URL is cleaned up to avoid leaks.
        cleanupObjectUrl();
      }

      return {
        audioUrl: playableUrl,
        rawAudioUrl,
        mimeType: resolvedMimeType,
        cached: Boolean(cached),
        duration: Number(duration),
        fileSize,
        cost,
      } satisfies TTSResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[TTS] Error:', errorMessage);
      return null;

    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  };

  return {
    generateSpeech,
    loading,
    error,
  };
}

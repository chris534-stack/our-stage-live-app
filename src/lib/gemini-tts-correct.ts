/**
 * Gemini 2.5 Flash TTS Integration (Correct Implementation)
 * Uses gemini-2.5-flash-preview-tts for batch text-to-speech with prompt control
 */

import { GoogleGenAI } from '@google/genai';

interface PcmFormatOptions {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

function wrapPcmAsWav(pcmData: Uint8Array, { sampleRate, channels, bitsPerSample }: PcmFormatOptions): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  buffer.writeUInt16LE(1, 20); // AudioFormat = PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  Buffer.from(pcmData).copy(buffer, 44);
  return buffer;
}

function parsePcmMimeType(mimeType: string): PcmFormatOptions {
  const defaults: PcmFormatOptions = {
    sampleRate: 24000,
    channels: 1,
    bitsPerSample: 16,
  };

  const [, ...params] = mimeType.split(';');
  for (const param of params) {
    const [keyRaw, valueRaw] = param.split('=');
    if (!keyRaw || !valueRaw) continue;
    const key = keyRaw.trim().toLowerCase();
    const value = valueRaw.trim();

    if (key === 'rate') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        defaults.sampleRate = parsed;
      }
    } else if (key === 'channels') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        defaults.channels = parsed;
      }
    } else if (key === 'bitdepth' || key === 'bits') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        defaults.bitsPerSample = parsed;
      }
    }
  }

  return defaults;
}

// Initialize Google Gen AI client
// Note: GoogleGenAI only needs the API key, not project/location
const getClient = () => {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY (or GEMINI_API_KEY) environment variable is required');
  }
  return new GoogleGenAI({ apiKey });
};

export interface GeminiTTSVoice {
  voiceId: string;
  voiceName: string; // Gemini voice name (Kore, Puck, etc.)
  description: string;
  promptStyle: string; // Style instruction for the prompt
  
  // Theatrical categorization
  gender: 'male' | 'female' | 'neutral';
  ageRange: 'child' | 'young' | 'mature' | 'elderly';
  archetype: 'ingenue' | 'hero' | 'villain' | 'comedic' | 'wise' | 'authority';
  traits: string[];
}

/**
 * Gemini TTS Voice Library
 * Using Gemini's prebuilt voices with style prompts
 */
export const GEMINI_TTS_VOICES: GeminiTTSVoice[] = [
  {
    voiceId: 'young_female_ingenue',
    voiceName: 'Aoede', // Warm, expressive female
    description: 'Young female ingenue - bright and optimistic',
    promptStyle: 'in a bright, youthful, and optimistic tone',
    gender: 'female',
    ageRange: 'young',
    archetype: 'ingenue',
    traits: ['bright', 'optimistic', 'romantic'],
  },
  {
    voiceId: 'young_male_hero',
    voiceName: 'Charon', // Deep, confident male
    description: 'Young male hero - strong and confident',
    promptStyle: 'in a strong, confident, and heroic tone',
    gender: 'male',
    ageRange: 'young',
    archetype: 'hero',
    traits: ['confident', 'heroic', 'earnest'],
  },
  {
    voiceId: 'young_female_confident',
    voiceName: 'Fenrir', // Assertive female
    description: 'Young female confident - strong and determined',
    promptStyle: 'in a confident, assertive, and determined tone',
    gender: 'female',
    ageRange: 'young',
    archetype: 'hero',
    traits: ['confident', 'strong', 'determined'],
  },
  {
    voiceId: 'comedic_male',
    voiceName: 'Puck', // Upbeat, playful male
    description: 'Comedic relief male - energetic and quirky',
    promptStyle: 'in an energetic, playful, and humorous tone',
    gender: 'male',
    ageRange: 'young',
    archetype: 'comedic',
    traits: ['energetic', 'quirky', 'humorous'],
  },
  {
    voiceId: 'comedic_female',
    voiceName: 'Kore', // Bright, cheerful female
    description: 'Comedic relief female - witty and sarcastic',
    promptStyle: 'in a witty, playful, and slightly sarcastic tone',
    gender: 'female',
    ageRange: 'young',
    archetype: 'comedic',
    traits: ['witty', 'playful', 'sarcastic'],
  },
  {
    voiceId: 'mature_male_authority',
    voiceName: 'Charon', // Deep male
    description: 'Mature male authority - commanding presence',
    promptStyle: 'in a deep, authoritative, and commanding tone',
    gender: 'male',
    ageRange: 'mature',
    archetype: 'authority',
    traits: ['authoritative', 'commanding', 'fatherly'],
  },
  {
    voiceId: 'mature_female_authority',
    voiceName: 'Aoede', // Warm female
    description: 'Mature female authority - wise and commanding',
    promptStyle: 'in a wise, authoritative, and graceful tone',
    gender: 'female',
    ageRange: 'mature',
    archetype: 'authority',
    traits: ['authoritative', 'wise', 'commanding'],
  },
  {
    voiceId: 'villain_male',
    voiceName: 'Enceladus', // Breathy, mysterious male
    description: 'Villain male - smooth and menacing',
    promptStyle: 'in a smooth, menacing, and calculating tone',
    gender: 'male',
    ageRange: 'mature',
    archetype: 'villain',
    traits: ['menacing', 'smooth', 'calculating'],
  },
  {
    voiceId: 'villain_female',
    voiceName: 'Fenrir', // Assertive female
    description: 'Villain female - cunning and sophisticated',
    promptStyle: 'in a sophisticated, cunning, and cold tone',
    gender: 'female',
    ageRange: 'mature',
    archetype: 'villain',
    traits: ['cunning', 'sophisticated', 'menacing'],
  },
  {
    voiceId: 'elderly_male_wise',
    voiceName: 'Enceladus', // Breathy male
    description: 'Elderly male wise - gentle and weathered',
    promptStyle: 'in a gentle, wise, and weathered tone',
    gender: 'male',
    ageRange: 'elderly',
    archetype: 'wise',
    traits: ['wise', 'gentle', 'weathered'],
  },
  {
    voiceId: 'elderly_female_wise',
    voiceName: 'Aoede', // Warm female
    description: 'Elderly female wise - warm and knowing',
    promptStyle: 'in a warm, wise, and gentle tone',
    gender: 'female',
    ageRange: 'elderly',
    archetype: 'wise',
    traits: ['warm', 'wise', 'gentle'],
  },
  {
    voiceId: 'child_female',
    voiceName: 'Kore', // Bright female
    description: 'Child female - sweet and innocent',
    promptStyle: 'in a sweet, innocent, and curious tone',
    gender: 'female',
    ageRange: 'child',
    archetype: 'ingenue',
    traits: ['playful', 'curious', 'innocent'],
  },
];

export interface TTSGenerationResult {
  audioBuffer: Buffer;
  mimeType?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
}

/**
 * Generate speech using Gemini 2.5 Pro TTS
 */
export async function generateGeminiTTS(
  text: string,
  voice: GeminiTTSVoice,
  options?: GenerateGeminiTTSOptions
): Promise<Buffer> {
  const result = await generateGeminiTTSWithMetadata(text, voice, options);
  return result.audioBuffer;
}

export interface GenerateGeminiTTSOptions {
  multiSpeakers?: Array<{
    speaker: string;
    voice: GeminiTTSVoice;
  }>;
}

/**
 * Generate speech with usage and cost metadata
 */
export async function generateGeminiTTSWithMetadata(
  text: string,
  voice: GeminiTTSVoice,
  options: GenerateGeminiTTSOptions = {}
): Promise<TTSGenerationResult> {
  const genAI = getClient();

  const { multiSpeakers = [] } = options;

  const uniqueSpeakers = multiSpeakers.filter(
    (item, index, self) => self.findIndex((other) => other.speaker === item.speaker) === index
  );

  const prompt = uniqueSpeakers.length > 0
    ? `${uniqueSpeakers
        .map(
          (config) => `${config.speaker} should speak ${config.voice.promptStyle}.`
        )
        .join('\n')}

${text}`
    : `Say ${voice.promptStyle}: ${text}`;

  const speechConfig = uniqueSpeakers.length > 0
    ? {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: uniqueSpeakers.map((config) => ({
            speaker: config.speaker,
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.voice.voiceName,
              },
            },
          })),
        },
      }
    : {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice.voiceName,
          },
        },
      };

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-pro-preview-tts',  // Using Pro for better quality
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: ['AUDIO'],  // Must be uppercase
      speechConfig,
    },
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  const mimeType = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType;
  
  if (!audioData) {
    throw new Error('No audio generated by Gemini TTS');
  }

  console.log('[Gemini TTS] Audio format:', mimeType);
  
  // Gemini returns the audio data - it should already be in a playable format
  const baseAudioBuffer = Buffer.from(audioData, 'base64');
  let effectiveMimeType = mimeType;

  const audioBuffer = ((): Buffer => {
    if (mimeType && mimeType.toLowerCase().startsWith('audio/l16')) {
      const format = parsePcmMimeType(mimeType);
      const pcmBytes = new Uint8Array(baseAudioBuffer.buffer, baseAudioBuffer.byteOffset, baseAudioBuffer.length);
      effectiveMimeType = 'audio/wav';
      return wrapPcmAsWav(pcmBytes, format);
    }

    return baseAudioBuffer;
  })();

  // Extract usage metadata
  const usageMetadata = response.usageMetadata;
  const usage = usageMetadata ? {
    inputTokens: usageMetadata.promptTokenCount || 0,
    outputTokens: usageMetadata.candidatesTokenCount || 0,
    totalTokens: usageMetadata.totalTokenCount || 0,
  } : undefined;

  // Calculate costs (Gemini 2.5 Pro pricing)
  // Input: $1.25 per 1M tokens
  // Output: $5.00 per 1M tokens
  const cost = usage ? {
    inputCost: (usage.inputTokens / 1_000_000) * 1.25,
    outputCost: (usage.outputTokens / 1_000_000) * 5.00,
    totalCost: ((usage.inputTokens / 1_000_000) * 1.25) + ((usage.outputTokens / 1_000_000) * 5.00),
  } : undefined;

  return {
    audioBuffer,
    mimeType: effectiveMimeType || 'audio/wav',
    usage,
    cost,
  };
}

/**
 * Get voice by ID
 */
export function getGeminiTTSVoiceById(voiceId: string): GeminiTTSVoice | undefined {
  return GEMINI_TTS_VOICES.find(v => v.voiceId === voiceId);
}

/**
 * Match character to voice (same logic as before)
 */
export function matchCharacterToGeminiTTS(
  characterName: string,
  characterLines: string[],
  usedVoiceIds: Set<string>
): GeminiTTSVoice {
  const hints = analyzeCharacter(characterName, characterLines);
  
  const scores = GEMINI_TTS_VOICES.map(voice => {
    let score = 0;
    
    if (hints.gender === voice.gender) score += 100;
    else if (hints.gender && voice.gender !== 'neutral') return { voice, score: -1 };
    
    if (hints.ageRange === voice.ageRange) score += 50;
    if (hints.archetype === voice.archetype) score += 75;
    
    hints.traits.forEach(trait => {
      if (voice.traits.includes(trait)) score += 25;
    });
    
    if (usedVoiceIds.has(voice.voiceId)) score -= 200;
    
    return { voice, score };
  });
  
  const best = scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  
  return best?.voice || GEMINI_TTS_VOICES[0];
}

function analyzeCharacter(name: string, lines: string[]) {
  const nameLower = name.toLowerCase();
  
  const hints = {
    gender: null as 'male' | 'female' | null,
    ageRange: null as 'child' | 'young' | 'mature' | 'elderly' | null,
    archetype: null as string | null,
    traits: [] as string[],
  };
  
  const maleKeywords = ['king', 'prince', 'lord', 'sir', 'mr', 'father', 'son', 'brother'];
  const femaleKeywords = ['queen', 'princess', 'lady', 'mrs', 'miss', 'mother', 'daughter', 'sister'];
  
  if (maleKeywords.some(k => nameLower.includes(k))) hints.gender = 'male';
  if (femaleKeywords.some(k => nameLower.includes(k))) hints.gender = 'female';
  
  if (nameLower.includes('old') || nameLower.includes('elder')) hints.ageRange = 'elderly';
  else if (nameLower.includes('young')) hints.ageRange = 'young';
  else if (nameLower.includes('child') || nameLower.includes('boy') || nameLower.includes('girl')) hints.ageRange = 'child';
  
  if (nameLower.includes('villain') || nameLower.includes('evil')) hints.archetype = 'villain';
  else if (nameLower.includes('fool') || nameLower.includes('jester')) hints.archetype = 'comedic';
  
  return hints;
}

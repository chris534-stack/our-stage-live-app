/**
 * Gemini 2.5 Native Audio TTS Integration
 * Uses Gemini's controllable text-to-speech for theatrical voices
 */

import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'our-stage-eugene-w930o',
  location: 'us-central1',
});

export interface GeminiVoicePrompt {
  voiceId: string;
  name: string;
  description: string;
  prompt: string;  // Natural language prompt for Gemini
  
  // Theatrical categorization
  gender: 'male' | 'female' | 'neutral';
  ageRange: 'child' | 'young' | 'mature' | 'elderly';
  archetype: 'ingenue' | 'hero' | 'villain' | 'comedic' | 'wise' | 'authority';
  traits: string[];
}

/**
 * Theatrical voice library using Gemini's natural language prompts
 * Gemini can generate any voice style from text descriptions!
 */
export const GEMINI_VOICE_LIBRARY: GeminiVoicePrompt[] = [
  {
    voiceId: 'young_female_ingenue',
    name: 'Young Female Ingenue',
    description: 'Bright, youthful female voice - romantic leads',
    prompt: 'Speak in a bright, youthful female voice with optimistic energy. Sound like a young woman in her early twenties, full of hope and enthusiasm. Use a warm, friendly tone with natural expressiveness.',
    gender: 'female',
    ageRange: 'young',
    archetype: 'ingenue',
    traits: ['bright', 'optimistic', 'romantic', 'energetic'],
  },
  {
    voiceId: 'young_male_hero',
    name: 'Young Male Hero',
    description: 'Strong, confident young male - leading men',
    prompt: 'Speak in a strong, confident young male voice. Sound like a heroic man in his mid-twenties with earnest conviction and natural charisma. Use clear, determined tones.',
    gender: 'male',
    ageRange: 'young',
    archetype: 'hero',
    traits: ['confident', 'heroic', 'earnest'],
  },
  {
    voiceId: 'young_female_confident',
    name: 'Young Female Confident',
    description: 'Confident young female - strong heroines',
    prompt: 'Speak in a confident, assertive young female voice. Sound like a strong woman in her twenties who knows what she wants. Use determined, clear tones with natural authority.',
    gender: 'female',
    ageRange: 'young',
    archetype: 'hero',
    traits: ['confident', 'strong', 'determined'],
  },
  {
    voiceId: 'comedic_male',
    name: 'Comedic Relief Male',
    description: 'Energetic, quirky male voice',
    prompt: 'Speak in an energetic, playful male voice with comedic timing. Sound animated and quirky, like someone who always has a joke ready. Use expressive, humorous tones.',
    gender: 'male',
    ageRange: 'young',
    archetype: 'comedic',
    traits: ['energetic', 'quirky', 'humorous'],
  },
  {
    voiceId: 'comedic_female',
    name: 'Comedic Relief Female',
    description: 'Witty, sarcastic female voice',
    prompt: 'Speak in a witty, sarcastic female voice with sharp comedic delivery. Sound clever and playful, with perfect timing for zingers. Use expressive, slightly sardonic tones.',
    gender: 'female',
    ageRange: 'young',
    archetype: 'comedic',
    traits: ['witty', 'playful', 'sarcastic'],
  },
  {
    voiceId: 'mature_male_authority',
    name: 'Mature Male Authority',
    description: 'Deep, authoritative male - kings, fathers',
    prompt: 'Speak in a deep, authoritative mature male voice. Sound like a man in his fifties with natural gravitas and commanding presence. Use measured, powerful tones that inspire respect.',
    gender: 'male',
    ageRange: 'mature',
    archetype: 'authority',
    traits: ['authoritative', 'commanding', 'fatherly'],
  },
  {
    voiceId: 'mature_female_authority',
    name: 'Mature Female Authority',
    description: 'Authoritative, wise female voice',
    prompt: 'Speak in an authoritative, wise mature female voice. Sound like a woman in her fifties with natural command and grace. Use confident, measured tones with warmth and wisdom.',
    gender: 'female',
    ageRange: 'mature',
    archetype: 'authority',
    traits: ['authoritative', 'wise', 'commanding'],
  },
  {
    voiceId: 'villain_male',
    name: 'Villain Male',
    description: 'Smooth, menacing male antagonist',
    prompt: 'Speak in a smooth, menacing male voice with subtle threat. Sound like a calculating villain who gets what he wants. Use controlled, slightly sinister tones with dangerous charm.',
    gender: 'male',
    ageRange: 'mature',
    archetype: 'villain',
    traits: ['menacing', 'smooth', 'calculating'],
  },
  {
    voiceId: 'villain_female',
    name: 'Villain Female',
    description: 'Cunning, sophisticated female antagonist',
    prompt: 'Speak in a sophisticated, cunning female voice with cold intelligence. Sound like a manipulative woman who always has a plan. Use controlled, slightly seductive tones with sharp edges.',
    gender: 'female',
    ageRange: 'mature',
    archetype: 'villain',
    traits: ['cunning', 'sophisticated', 'menacing'],
  },
  {
    voiceId: 'elderly_male_wise',
    name: 'Elderly Male Wise',
    description: 'Gentle, wise elderly male - mentors',
    prompt: 'Speak in a gentle, wise elderly male voice. Sound like a grandfather in his seventies with warmth and life experience. Use soft, weathered tones that convey deep wisdom.',
    gender: 'male',
    ageRange: 'elderly',
    archetype: 'wise',
    traits: ['wise', 'gentle', 'weathered'],
  },
  {
    voiceId: 'elderly_female_wise',
    name: 'Elderly Female Wise',
    description: 'Warm, wise elderly female - mentors',
    prompt: 'Speak in a warm, wise elderly female voice. Sound like a grandmother in her seventies with gentle kindness and ancient wisdom. Use soft, knowing tones that offer comfort.',
    gender: 'female',
    ageRange: 'elderly',
    archetype: 'wise',
    traits: ['warm', 'wise', 'gentle'],
  },
  {
    voiceId: 'child_female',
    name: 'Child Female',
    description: 'Sweet, innocent young girl',
    prompt: 'Speak in a sweet, innocent young girl voice. Sound like a precocious child around 10 years old with natural curiosity. Use bright, youthful tones with genuine wonder.',
    gender: 'female',
    ageRange: 'child',
    archetype: 'ingenue',
    traits: ['innocent', 'curious', 'sweet'],
  },
];

/**
 * Generate speech using Gemini 2.5 Flash with native audio
 */
export async function generateGeminiSpeech(
  text: string,
  voicePrompt: string,
  options?: {
    model?: 'gemini-2.5-flash' | 'gemini-2.5-pro';  // Flash for cost, Pro for quality
    temperature?: number;  // 0.0 to 1.0
  }
): Promise<Buffer> {
  const modelName = options?.model || 'gemini-2.5-flash-preview-0205';
  
  const generativeModel = vertexAI.getGenerativeModel({
    model: modelName,
  });

  // Construct prompt with voice instructions
  const fullPrompt = `${voicePrompt}

Now read this text aloud with that voice:

"${text}"`;

  const request = {
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: options?.temperature || 0.9,
      // Request audio output
      responseModalities: ['AUDIO'],
    },
  };

  const response = await generativeModel.generateContent(request);
  
  // Extract audio from response
  const audioData = response.response.candidates?.[0]?.content?.parts?.find(
    part => part.inlineData?.mimeType?.startsWith('audio/')
  );

  if (!audioData?.inlineData?.data) {
    throw new Error('No audio generated by Gemini');
  }

  // Convert base64 to buffer
  return Buffer.from(audioData.inlineData.data, 'base64');
}

/**
 * Get voice by ID from library
 */
export function getGeminiVoiceById(voiceId: string): GeminiVoicePrompt | undefined {
  return GEMINI_VOICE_LIBRARY.find(v => v.voiceId === voiceId);
}

/**
 * Match character to appropriate Gemini voice
 */
export function matchCharacterToGeminiVoice(
  characterName: string,
  characterLines: string[],
  usedVoiceIds: Set<string>
): GeminiVoicePrompt {
  const hints = analyzeCharacter(characterName, characterLines);
  
  // Score each voice
  const scores = GEMINI_VOICE_LIBRARY.map(voice => {
    let score = 0;
    
    // Gender match
    if (hints.gender === voice.gender) score += 100;
    else if (hints.gender && voice.gender !== 'neutral') return { voice, score: -1 };
    
    // Age match
    if (hints.ageRange === voice.ageRange) score += 50;
    
    // Archetype match
    if (hints.archetype === voice.archetype) score += 75;
    
    // Trait matches
    hints.traits.forEach(trait => {
      if (voice.traits.includes(trait)) score += 25;
    });
    
    // Penalize if already used
    if (usedVoiceIds.has(voice.voiceId)) score -= 200;
    
    return { voice, score };
  });
  
  const best = scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  
  return best?.voice || GEMINI_VOICE_LIBRARY[0];
}

function analyzeCharacter(name: string, lines: string[]) {
  const nameLower = name.toLowerCase();
  
  const hints = {
    gender: null as 'male' | 'female' | null,
    ageRange: null as 'child' | 'young' | 'mature' | 'elderly' | null,
    archetype: null as string | null,
    traits: [] as string[],
  };
  
  // Gender detection
  const maleKeywords = ['king', 'prince', 'lord', 'sir', 'mr', 'father', 'son', 'brother'];
  const femaleKeywords = ['queen', 'princess', 'lady', 'mrs', 'miss', 'mother', 'daughter', 'sister'];
  
  if (maleKeywords.some(k => nameLower.includes(k))) hints.gender = 'male';
  if (femaleKeywords.some(k => nameLower.includes(k))) hints.gender = 'female';
  
  // Age detection
  if (nameLower.includes('old') || nameLower.includes('elder')) hints.ageRange = 'elderly';
  else if (nameLower.includes('young')) hints.ageRange = 'young';
  else if (nameLower.includes('child') || nameLower.includes('boy') || nameLower.includes('girl')) hints.ageRange = 'child';
  
  // Archetype detection
  if (nameLower.includes('villain') || nameLower.includes('evil')) hints.archetype = 'villain';
  else if (nameLower.includes('fool') || nameLower.includes('jester')) hints.archetype = 'comedic';
  
  return hints;
}

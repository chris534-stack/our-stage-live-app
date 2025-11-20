/**
 * Google Cloud Text-to-Speech Integration
 * Professional voice library for script rehearsal
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Initialize client (uses GOOGLE_APPLICATION_CREDENTIALS env var)
const client = new TextToSpeechClient();

export interface GoogleTTSVoice {
  voiceId: string;
  name: string;
  languageCode: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  description: string;
  
  // Theatrical categorization
  ageRange: 'child' | 'young' | 'mature' | 'elderly';
  archetype: 'ingenue' | 'hero' | 'villain' | 'comedic' | 'wise' | 'authority';
  traits: string[];
}

/**
 * Curated voice library for theatrical archetypes
 * Using Google's Neural2 voices (highest quality)
 */
export const THEATRICAL_VOICE_LIBRARY: GoogleTTSVoice[] = [
  // Young Female Voices
  {
    voiceId: 'en-US-Neural2-C',
    name: 'Young Female Ingenue',
    languageCode: 'en-US',
    ssmlGender: 'FEMALE',
    description: 'Bright, youthful female voice - perfect for romantic leads',
    ageRange: 'young',
    archetype: 'ingenue',
    traits: ['bright', 'optimistic', 'romantic', 'energetic'],
  },
  {
    voiceId: 'en-US-Neural2-E',
    name: 'Young Female Confident',
    languageCode: 'en-US',
    ssmlGender: 'FEMALE',
    description: 'Confident young female - strong heroines',
    ageRange: 'young',
    archetype: 'hero',
    traits: ['confident', 'strong', 'determined'],
  },
  {
    voiceId: 'en-US-Neural2-G',
    name: 'Young Female Comedic',
    languageCode: 'en-US',
    ssmlGender: 'FEMALE',
    description: 'Playful, witty female voice',
    ageRange: 'young',
    archetype: 'comedic',
    traits: ['witty', 'playful', 'sarcastic'],
  },
  
  // Young Male Voices
  {
    voiceId: 'en-US-Neural2-A',
    name: 'Young Male Hero',
    languageCode: 'en-US',
    ssmlGender: 'MALE',
    description: 'Strong, confident young male - leading men',
    ageRange: 'young',
    archetype: 'hero',
    traits: ['confident', 'heroic', 'earnest'],
  },
  {
    voiceId: 'en-US-Neural2-I',
    name: 'Young Male Comedic',
    languageCode: 'en-US',
    ssmlGender: 'MALE',
    description: 'Energetic, quirky male voice',
    ageRange: 'young',
    archetype: 'comedic',
    traits: ['energetic', 'quirky', 'humorous'],
  },
  
  // Mature Female Voices
  {
    voiceId: 'en-US-Neural2-F',
    name: 'Mature Female Authority',
    languageCode: 'en-US',
    ssmlGender: 'FEMALE',
    description: 'Authoritative, wise female voice',
    ageRange: 'mature',
    archetype: 'authority',
    traits: ['authoritative', 'wise', 'commanding'],
  },
  {
    voiceId: 'en-US-Neural2-H',
    name: 'Mature Female Villain',
    languageCode: 'en-US',
    ssmlGender: 'FEMALE',
    description: 'Sophisticated, cunning female antagonist',
    ageRange: 'mature',
    archetype: 'villain',
    traits: ['cunning', 'sophisticated', 'menacing'],
  },
  
  // Mature Male Voices
  {
    voiceId: 'en-US-Neural2-D',
    name: 'Mature Male Authority',
    languageCode: 'en-US',
    ssmlGender: 'MALE',
    description: 'Deep, authoritative male voice - kings, fathers',
    ageRange: 'mature',
    archetype: 'authority',
    traits: ['authoritative', 'commanding', 'fatherly'],
  },
  {
    voiceId: 'en-US-Neural2-J',
    name: 'Mature Male Villain',
    languageCode: 'en-US',
    ssmlGender: 'MALE',
    description: 'Smooth, menacing male antagonist',
    ageRange: 'mature',
    archetype: 'villain',
    traits: ['menacing', 'smooth', 'calculating'],
  },
  
  // Elderly Voices
  {
    voiceId: 'en-GB-Neural2-A',
    name: 'Elderly Female Wise',
    languageCode: 'en-GB',
    ssmlGender: 'FEMALE',
    description: 'Warm, wise elderly female - grandmothers, mentors',
    ageRange: 'elderly',
    archetype: 'wise',
    traits: ['warm', 'wise', 'gentle'],
  },
  {
    voiceId: 'en-GB-Neural2-B',
    name: 'Elderly Male Wise',
    languageCode: 'en-GB',
    ssmlGender: 'MALE',
    description: 'Gentle, wise elderly male - grandfathers, mentors',
    ageRange: 'elderly',
    archetype: 'wise',
    traits: ['wise', 'gentle', 'weathered'],
  },
  
  // Child Voices
  {
    voiceId: 'en-US-Wavenet-F',
    name: 'Child Female',
    languageCode: 'en-US',
    ssmlGender: 'FEMALE',
    description: 'Young girl voice',
    ageRange: 'child',
    archetype: 'ingenue',
    traits: ['innocent', 'curious', 'sweet'],
  },
];

/**
 * Generate speech using Google Cloud TTS
 */
export async function generateSpeech(
  text: string,
  voiceId: string,
  options?: {
    speakingRate?: number;  // 0.25 to 4.0 (default: 1.0)
    pitch?: number;         // -20.0 to 20.0 (default: 0)
    volumeGainDb?: number;  // -96.0 to 16.0 (default: 0)
  }
): Promise<Buffer> {
  const request = {
    input: { text },
    voice: {
      languageCode: voiceId.startsWith('en-GB') ? 'en-GB' : 'en-US',
      name: voiceId,
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      speakingRate: options?.speakingRate || 1.0,
      pitch: options?.pitch || 0,
      volumeGainDb: options?.volumeGainDb || 0,
    },
  };

  const [response] = await client.synthesizeSpeech(request);
  
  if (!response.audioContent) {
    throw new Error('No audio content received from Google TTS');
  }

  return Buffer.from(response.audioContent);
}

/**
 * Get voice by ID from library
 */
export function getVoiceById(voiceId: string): GoogleTTSVoice | undefined {
  return THEATRICAL_VOICE_LIBRARY.find(v => v.voiceId === voiceId);
}

/**
 * Match character to appropriate voice
 */
export function matchCharacterToGoogleVoice(
  characterName: string,
  characterLines: string[],
  usedVoiceIds: Set<string>
): GoogleTTSVoice {
  const hints = analyzeCharacter(characterName, characterLines);
  
  // Score each voice
  const scores = THEATRICAL_VOICE_LIBRARY.map(voice => {
    let score = 0;
    
    // Gender match (required)
    if (hints.gender === 'male' && voice.ssmlGender === 'MALE') {
      score += 100;
    } else if (hints.gender === 'female' && voice.ssmlGender === 'FEMALE') {
      score += 100;
    } else if (hints.gender && voice.ssmlGender !== 'NEUTRAL') {
      return { voice, score: -1 };
    }
    
    // Age match
    if (hints.ageRange && voice.ageRange === hints.ageRange) {
      score += 50;
    }
    
    // Archetype match
    if (hints.archetype && voice.archetype === hints.archetype) {
      score += 75;
    }
    
    // Trait matches
    hints.traits.forEach(trait => {
      if (voice.traits.includes(trait)) score += 25;
    });
    
    // Penalize if already used
    if (usedVoiceIds.has(voice.voiceId)) {
      score -= 200;
    }
    
    return { voice, score };
  });
  
  const best = scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  
  return best?.voice || THEATRICAL_VOICE_LIBRARY[0];
}

function analyzeCharacter(name: string, lines: string[]) {
  const nameLower = name.toLowerCase();
  const firstLines = lines.slice(0, 3).join(' ').toLowerCase();
  
  const hints = {
    gender: null as 'male' | 'female' | null,
    ageRange: null as 'child' | 'young' | 'mature' | 'elderly' | null,
    archetype: null as string | null,
    traits: [] as string[],
  };
  
  // Gender detection
  const maleKeywords = ['king', 'prince', 'lord', 'sir', 'mr', 'father', 'son', 'brother', 'duke'];
  const femaleKeywords = ['queen', 'princess', 'lady', 'mrs', 'miss', 'mother', 'daughter', 'sister'];
  
  if (maleKeywords.some(k => nameLower.includes(k))) hints.gender = 'male';
  if (femaleKeywords.some(k => nameLower.includes(k))) hints.gender = 'female';
  
  // Age detection
  if (nameLower.includes('old') || nameLower.includes('elder')) {
    hints.ageRange = 'elderly';
  } else if (nameLower.includes('young')) {
    hints.ageRange = 'young';
  } else if (nameLower.includes('child') || nameLower.includes('boy') || nameLower.includes('girl')) {
    hints.ageRange = 'child';
  }
  
  // Archetype detection
  if (nameLower.includes('villain') || nameLower.includes('evil')) {
    hints.archetype = 'villain';
  } else if (nameLower.includes('fool') || nameLower.includes('jester')) {
    hints.archetype = 'comedic';
  }
  
  return hints;
}

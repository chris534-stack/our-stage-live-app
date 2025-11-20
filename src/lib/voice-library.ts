/**
 * Voice Library Management for VoxCPM TTS
 * Handles voice archetype storage and character matching
 */

import { db, storage } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface VoiceArchetype {
  voiceId: string;
  voiceName: string;
  description: string;
  promptText: string;
  audioUrl: string;  // Firebase Storage URL
  
  // Tags for matching
  gender: 'male' | 'female' | 'neutral';
  ageRange: 'child' | 'young' | 'mature' | 'elderly';
  archetype: 'ingenue' | 'hero' | 'villain' | 'comedic' | 'wise' | 'authority';
  traits: string[];  // Additional traits: confident, innocent, menacing, etc.
  
  // Metadata
  createdAt: Date;
  fileSize: number;
  duration: number;  // seconds
  usageCount: number;
}

export interface CharacterVoiceAssignment {
  characterName: string;
  voiceId: string;
  voiceName: string;
  audioUrl: string;
  promptText: string;
  assignedAt: Date;
  isManual: boolean;  // User override vs auto-assigned
}

/**
 * Upload voice library to Firestore and Firebase Storage
 */
export async function uploadVoiceToLibrary(
  voiceId: string,
  audioFile: File,
  metadata: Omit<VoiceArchetype, 'voiceId' | 'audioUrl' | 'createdAt' | 'usageCount'>
): Promise<VoiceArchetype> {
  // 1. Upload audio to Firebase Storage
  const storageRef = ref(storage, `voice-library/${voiceId}.wav`);
  await uploadBytes(storageRef, audioFile);
  const audioUrl = await getDownloadURL(storageRef);
  
  // 2. Create Firestore document
  const voice: VoiceArchetype = {
    voiceId,
    audioUrl,
    createdAt: new Date(),
    usageCount: 0,
    ...metadata,
  };
  
  await setDoc(doc(db, 'voiceLibrary', voiceId), voice);
  
  return voice;
}

/**
 * Get all voices from library
 */
export async function getVoiceLibrary(): Promise<VoiceArchetype[]> {
  const snapshot = await getDocs(collection(db, 'voiceLibrary'));
  return snapshot.docs.map(doc => doc.data() as VoiceArchetype);
}

/**
 * Match character to appropriate voice from library
 */
export async function matchCharacterToVoice(
  characterName: string,
  characterLines: string[],
  usedVoiceIds: Set<string>
): Promise<VoiceArchetype | null> {
  const library = await getVoiceLibrary();
  
  // Analyze character
  const hints = analyzeCharacter(characterName, characterLines);
  
  // Score each voice
  const scores = library.map(voice => {
    let score = 0;
    
    // Gender match (required)
    if (hints.gender && voice.gender === hints.gender) {
      score += 100;
    } else if (hints.gender && voice.gender !== 'neutral') {
      return { voice, score: -1 };  // Wrong gender = disqualify
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
    
    // Penalize if already used in this show
    if (usedVoiceIds.has(voice.voiceId)) {
      score -= 200;
    }
    
    return { voice, score };
  });
  
  // Return highest scoring voice
  const best = scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  
  return best?.voice || null;
}

/**
 * Analyze character name and lines to extract hints
 */
function analyzeCharacter(name: string, lines: string[]): {
  gender: 'male' | 'female' | null;
  ageRange: 'child' | 'young' | 'mature' | 'elderly' | null;
  archetype: string | null;
  traits: string[];
} {
  const nameLower = name.toLowerCase();
  const firstLines = lines.slice(0, 3).join(' ').toLowerCase();
  
  const hints = {
    gender: null as 'male' | 'female' | null,
    ageRange: null as 'child' | 'young' | 'mature' | 'elderly' | null,
    archetype: null as string | null,
    traits: [] as string[],
  };
  
  // Gender detection
  const maleKeywords = ['king', 'prince', 'lord', 'sir', 'mr', 'father', 'son', 'brother', 'duke', 'baron'];
  const femaleKeywords = ['queen', 'princess', 'lady', 'mrs', 'miss', 'mother', 'daughter', 'sister', 'duchess'];
  
  if (maleKeywords.some(k => nameLower.includes(k))) hints.gender = 'male';
  if (femaleKeywords.some(k => nameLower.includes(k))) hints.gender = 'female';
  
  // Age detection
  if (nameLower.includes('old') || nameLower.includes('elder') || nameLower.includes('grandfather') || nameLower.includes('grandmother')) {
    hints.ageRange = 'elderly';
  } else if (nameLower.includes('young') || nameLower.includes('youth')) {
    hints.ageRange = 'young';
  } else if (nameLower.includes('child') || nameLower.includes('boy') || nameLower.includes('girl')) {
    hints.ageRange = 'child';
  }
  
  // Archetype detection
  if (nameLower.includes('villain') || nameLower.includes('witch') || nameLower.includes('evil')) {
    hints.archetype = 'villain';
  } else if (nameLower.includes('fool') || nameLower.includes('jester') || nameLower.includes('clown')) {
    hints.archetype = 'comedic';
  } else if (nameLower.includes('hero') || nameLower.includes('knight')) {
    hints.archetype = 'hero';
  }
  
  // Trait detection from dialogue
  if (firstLines.includes('haha') || firstLines.includes('joke') || firstLines.includes('funny')) {
    hints.traits.push('comedic');
  }
  if (firstLines.includes('love') || firstLines.includes('heart') || firstLines.includes('dear')) {
    hints.traits.push('romantic');
  }
  if (firstLines.includes('command') || firstLines.includes('order') || firstLines.includes('must')) {
    hints.traits.push('authority');
  }
  
  return hints;
}

/**
 * Assign voices to all characters in a show
 */
export async function assignVoicesToShow(
  showId: string,
  characters: Array<{ name: string; lines: string[] }>
): Promise<Map<string, CharacterVoiceAssignment>> {
  const assignments = new Map<string, CharacterVoiceAssignment>();
  const usedVoiceIds = new Set<string>();
  
  // Sort by line count (main characters first)
  const sorted = [...characters].sort((a, b) => b.lines.length - a.lines.length);
  
  for (const character of sorted) {
    const voice = await matchCharacterToVoice(
      character.name,
      character.lines,
      usedVoiceIds
    );
    
    if (voice) {
      const assignment: CharacterVoiceAssignment = {
        characterName: character.name,
        voiceId: voice.voiceId,
        voiceName: voice.voiceName,
        audioUrl: voice.audioUrl,
        promptText: voice.promptText,
        assignedAt: new Date(),
        isManual: false,
      };
      
      assignments.set(character.name, assignment);
      usedVoiceIds.add(voice.voiceId);
      
      // Save to Firestore
      await setDoc(
        doc(db, 'shows', showId, 'characterVoices', character.name),
        assignment
      );
    }
  }
  
  return assignments;
}

/**
 * Get character voice assignments for a show
 */
export async function getShowCharacterVoices(
  showId: string
): Promise<Map<string, CharacterVoiceAssignment>> {
  const snapshot = await getDocs(
    collection(db, 'shows', showId, 'characterVoices')
  );
  
  const assignments = new Map<string, CharacterVoiceAssignment>();
  snapshot.docs.forEach(doc => {
    const data = doc.data() as CharacterVoiceAssignment;
    assignments.set(data.characterName, data);
  });
  
  return assignments;
}

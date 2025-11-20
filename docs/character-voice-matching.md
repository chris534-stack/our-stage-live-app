# Character Voice Matching Algorithm

## Goal
Automatically assign appropriate voices from the library to script characters based on character names, descriptions, and context.

## Voice Library Tags

Each voice has tags:
- **Gender**: male, female
- **Age**: child, young, mature, elderly
- **Archetype**: ingenue, hero, villain, comedic, wise, authority
- **Traits**: confident, innocent, menacing, witty, etc.

## Matching Strategy

### 1. Parse Character Name
```typescript
function analyzeCharacterName(name: string): CharacterHints {
  const hints = {
    gender: null,
    age: null,
    archetype: null,
  };
  
  const nameLower = name.toLowerCase();
  
  // Gender hints from names
  const maleNames = ['john', 'james', 'robert', 'michael', 'william', 'king', 'prince', 'lord', 'sir', 'mr'];
  const femaleNames = ['mary', 'elizabeth', 'sarah', 'queen', 'princess', 'lady', 'mrs', 'miss'];
  
  if (maleNames.some(n => nameLower.includes(n))) hints.gender = 'male';
  if (femaleNames.some(n => nameLower.includes(n))) hints.gender = 'female';
  
  // Age hints
  if (nameLower.includes('old') || nameLower.includes('elder') || nameLower.includes('grandfather') || nameLower.includes('grandmother')) {
    hints.age = 'elderly';
  }
  if (nameLower.includes('young') || nameLower.includes('boy') || nameLower.includes('girl') || nameLower.includes('child')) {
    hints.age = 'young';
  }
  
  // Archetype hints
  if (nameLower.includes('villain') || nameLower.includes('witch') || nameLower.includes('evil')) {
    hints.archetype = 'villain';
  }
  if (nameLower.includes('fool') || nameLower.includes('jester') || nameLower.includes('clown')) {
    hints.archetype = 'comedic';
  }
  
  return hints;
}
```

### 2. Analyze First Lines
```typescript
function analyzeCharacterLines(lines: string[]): CharacterHints {
  const firstLines = lines.slice(0, 3).join(' ').toLowerCase();
  
  const hints = {
    traits: [],
  };
  
  // Detect personality from dialogue
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
```

### 3. Match to Voice Library
```typescript
function matchVoiceToCharacter(
  characterName: string,
  characterLines: string[],
  voiceLibrary: Voice[],
  usedVoices: Set<string>
): Voice {
  const nameHints = analyzeCharacterName(characterName);
  const lineHints = analyzeCharacterLines(characterLines);
  
  // Score each voice
  const scores = voiceLibrary.map(voice => {
    let score = 0;
    
    // Gender match (required)
    if (nameHints.gender && voice.tags.includes(nameHints.gender)) {
      score += 100;
    } else if (nameHints.gender) {
      return { voice, score: -1 };  // Wrong gender = disqualify
    }
    
    // Age match
    if (nameHints.age && voice.tags.includes(nameHints.age)) {
      score += 50;
    }
    
    // Archetype match
    if (nameHints.archetype && voice.tags.includes(nameHints.archetype)) {
      score += 75;
    }
    
    // Trait matches
    lineHints.traits.forEach(trait => {
      if (voice.tags.includes(trait)) score += 25;
    });
    
    // Penalize if already used in this show
    if (usedVoices.has(voice.id)) {
      score -= 200;
    }
    
    return { voice, score };
  });
  
  // Return highest scoring voice
  const best = scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  
  return best?.voice || voiceLibrary[0];  // Fallback to first voice
}
```

### 4. Ensemble Distribution
```typescript
function assignVoicesToCast(
  characters: Array<{ name: string; lines: string[] }>,
  voiceLibrary: Voice[]
): Map<string, Voice> {
  const assignments = new Map();
  const usedVoices = new Set<string>();
  
  // Sort characters by number of lines (main characters first)
  const sorted = characters.sort((a, b) => b.lines.length - a.lines.length);
  
  for (const character of sorted) {
    const voice = matchVoiceToCharacter(
      character.name,
      character.lines,
      voiceLibrary,
      usedVoices
    );
    
    assignments.set(character.name, voice);
    usedVoices.add(voice.id);
  }
  
  return assignments;
}
```

## Example Matches

**"Hamlet" (young male hero)**
- Matches: `young_male_hero`
- Tags: male, young, hero, confident

**"Ophelia" (young female ingenue)**
- Matches: `young_female_ingenue`
- Tags: female, young, ingenue, romantic

**"Claudius" (mature male villain)**
- Matches: `villain_male`
- Tags: male, mature, villain, authority

**"Polonius" (elderly male comedic)**
- Matches: `elderly_male_wise` or `comedic_relief_male`
- Depends on line analysis

## Fallback Strategy

If we run out of unique voices (more than 12 characters):
1. Reuse voices for minor characters (< 5 lines)
2. Prioritize voice uniqueness for characters with dialogue together
3. Generate new voice on-the-fly if needed

## User Override

Allow users to manually reassign voices:
```typescript
interface VoiceAssignment {
  characterName: string;
  voiceId: string;
  isManual: boolean;  // User override vs auto-assigned
}
```

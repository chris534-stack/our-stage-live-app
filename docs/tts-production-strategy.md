# VoxCPM Production Strategy for Script Rehearsal

## Voice Consistency System

### Phase 1: Character Voice Generation (One-time per show)

When a show is first uploaded:

1. **Extract unique characters** from script
2. **Generate voice prompt** for each character:
   ```typescript
   // Generate a neutral sample for each character
   const voicePrompt = await voxcpm.generate({
     text: `Hello, my name is ${characterName}. This is a voice sample for character consistency.`,
     cfg_value: 2.0,
     inference_timesteps: 20,  // High quality for reference
   });
   
   // Save to Firestore + Cloud Storage
   await saveCharacterVoice(showId, characterName, voicePrompt);
   ```

3. **Store in Firestore**:
   ```
   shows/{showId}/characterVoices/{characterName}
   ```

### Phase 2: Script Line Generation (Per user upload)

For each dialogue line:

```typescript
async function generateDialogueLine(
  showId: string,
  characterName: string,
  lineText: string,
  sceneContext?: string
) {
  // 1. Get character's voice prompt
  const characterVoice = await getCharacterVoice(showId, characterName);
  
  // 2. Check cache for exact match
  const cachedLine = await findCachedLine(showId, characterName, lineText);
  if (cachedLine) return cachedLine;
  
  // 3. Generate with voice consistency
  const audio = await voxcpm.generate({
    text: lineText,
    prompt_wav_path: characterVoice.url,  // ← Ensures same voice
    prompt_text: characterVoice.transcript,
    cfg_value: 2.0,
    inference_timesteps: 15,  // Balanced quality/cost
  });
  
  // 4. Cache for future users
  await cacheLineForShow(showId, characterName, lineText, audio);
  
  return audio;
}
```

## Text Segmentation Strategy

### Optimal Line Length

**Target: 1-3 sentences per generation (10-30 seconds)**

```typescript
function segmentScript(rawText: string): string[] {
  // Don't split on every period - keep natural phrasing
  const segments = [];
  let currentSegment = "";
  
  const sentences = rawText.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    const testSegment = currentSegment + " " + sentence;
    
    // Keep adding sentences until we hit ~30 seconds worth
    if (testSegment.split(" ").length < 50) {  // ~30 sec at normal pace
      currentSegment = testSegment.trim();
    } else {
      segments.push(currentSegment);
      currentSegment = sentence;
    }
  }
  
  if (currentSegment) segments.push(currentSegment);
  return segments;
}
```

### Example: Hamlet's Monologue

```typescript
// ❌ Bad: Too fragmented (loses prosody)
const lines = [
  "To be, or not to be.",
  "That is the question.",
  "Whether 'tis nobler in the mind to suffer.",
  // ... 20 more fragments
];

// ✅ Good: Natural phrasing (maintains emotion)
const lines = [
  "To be, or not to be, that is the question. Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing end them?",
  
  "To die: to sleep; No more; and by a sleep to say we end the heart-ache and the thousand natural shocks that flesh is heir to, 'tis a consummation devoutly to be wish'd.",
  
  "To die, to sleep; To sleep: perchance to dream: ay, there's the rub; For in that sleep of death what dreams may come when we have shuffled off this mortal coil, must give us pause."
];
```

## Context-Aware Dialogue Generation

### Scene-Level Context

```typescript
interface SceneDialogue {
  sceneNumber: number;
  sceneTitle: string;
  emotionalTone: string;  // "tense", "romantic", "comedic"
  lines: Array<{
    characterName: string;
    text: string;
    precedingLine?: string;  // Previous line for context
  }>;
}

async function generateSceneDialogue(scene: SceneDialogue) {
  const results = [];
  
  for (let i = 0; i < scene.lines.length; i++) {
    const line = scene.lines[i];
    const characterVoice = await getCharacterVoice(showId, line.characterName);
    
    // Include previous line for context awareness
    const contextText = line.precedingLine 
      ? `[Previous: "${line.precedingLine}"] ${line.text}`
      : line.text;
    
    const audio = await voxcpm.generate({
      text: contextText,
      prompt_wav_path: characterVoice.url,
      prompt_text: characterVoice.transcript,
      cfg_value: 2.0,
      inference_timesteps: 15,
    });
    
    results.push({
      lineId: `${scene.sceneNumber}_${i}`,
      characterName: line.characterName,
      audioUrl: await uploadToStorage(audio),
    });
  }
  
  return results;
}
```

## Cost Optimization with Quality Tiers

```typescript
enum QualityTier {
  DRAFT = "draft",        // Quick preview (timesteps: 10)
  STANDARD = "standard",  // Default (timesteps: 15)
  HIGH = "high",          // Main characters (timesteps: 20)
  PREMIUM = "premium",    // Final polish (timesteps: 25, retry: true)
}

function getGenerationSettings(tier: QualityTier) {
  switch (tier) {
    case QualityTier.DRAFT:
      return { inference_timesteps: 10, retry_badcase: false, denoise: false };
    
    case QualityTier.STANDARD:
      return { inference_timesteps: 15, retry_badcase: false, denoise: false };
    
    case QualityTier.HIGH:
      return { inference_timesteps: 20, retry_badcase: false, denoise: true };
    
    case QualityTier.PREMIUM:
      return { inference_timesteps: 25, retry_badcase: true, denoise: true };
  }
}

// Usage
const mainCharacters = ["Hamlet", "Ophelia", "Claudius"];
const tier = mainCharacters.includes(characterName) 
  ? QualityTier.HIGH 
  : QualityTier.STANDARD;
```

## Testing Recommendations

### Test 1: Voice Consistency
Generate 5 different lines with the same character voice prompt:
```typescript
const hamletVoice = { url: "...", transcript: "..." };

for (const line of hamletLines) {
  await voxcpm.generate({
    text: line,
    prompt_wav_path: hamletVoice.url,  // Same voice each time
    prompt_text: hamletVoice.transcript,
  });
}
// Listen: Should sound like the same person
```

### Test 2: Long-Form Monologue
Generate a full paragraph (30-60 seconds):
```typescript
const monologue = `To be, or not to be, that is the question. Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing end them?`;

await voxcpm.generate({
  text: monologue,
  inference_timesteps: 20,
});
// Listen: Should have natural prosody, not robotic
```

### Test 3: Dialogue Continuity
Generate back-and-forth dialogue:
```typescript
const dialogue = [
  { char: "Romeo", text: "But, soft! what light through yonder window breaks?" },
  { char: "Juliet", text: "O Romeo, Romeo! wherefore art thou Romeo?" },
  { char: "Romeo", text: "Shall I hear more, or shall I speak at this?" },
];

// Generate with character-specific voices
// Listen: Should feel like a conversation, not isolated clips
```

## Next Steps

1. **Create voice prompt generator** endpoint
2. **Test voice consistency** with multiple lines
3. **Test long-form generation** (30+ second monologues)
4. **Implement Firestore caching** with character voices
5. **Build scene-level batch processor**

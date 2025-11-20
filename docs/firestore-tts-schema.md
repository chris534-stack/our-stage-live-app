# Firestore Schema for TTS Script Rehearsal Feature

## Design Goals
1. **Show-level caching**: Reuse audio across cast members
2. **Character voice consistency**: Same character = same voice throughout
3. **Line deduplication**: Match similar lines to avoid redundant generation
4. **Voice library**: Auto-assign voices based on character metadata

---

## Collections

### `shows` (Root Collection)
Represents a theatrical production with cached script data.

```typescript
{
  showId: string;  // Auto-generated or normalized from title
  title: string;   // e.g., "Hamilton"
  normalizedTitle: string;  // Lowercase, no punctuation for matching
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Character voice assignments (persistent across all users)
  characterVoices: {
    [characterName: string]: {
      voiceId: string;  // Reference to voice library
      voiceName: string;  // e.g., "Mature Male - British"
      assignedAt: Timestamp;
      assignedBy: string;  // userId who first uploaded this character
    }
  };
  
  // Metadata for voice assignment
  metadata?: {
    genre?: string;  // "Musical", "Drama", "Comedy"
    era?: string;    // "Contemporary", "Period", "Historical"
    tone?: string;   // "Serious", "Light", "Dark"
  };
}
```

---

### `shows/{showId}/lines` (Subcollection)
Cached dialogue lines with generated audio.

```typescript
{
  lineId: string;  // Hash of normalized text for deduplication
  characterName: string;
  normalizedCharacter: string;  // Lowercase for matching
  
  // Original text and normalized version for fuzzy matching
  text: string;
  normalizedText: string;  // Lowercase, no punctuation, trimmed
  textHash: string;  // SHA-256 for exact matching
  
  // Audio generation
  audioUrl: string;  // Cloud Storage URL
  audioStatus: 'generating' | 'completed' | 'failed';
  duration: number;  // seconds
  voiceId: string;  // Which voice was used
  
  // Generation metadata
  generatedAt: Timestamp;
  generatedBy: string;  // userId who triggered generation
  ttsParams: {
    cfg_value: number;
    inference_timesteps: number;
    normalize: boolean;
    denoise: boolean;
  };
  
  // Usage tracking
  usageCount: number;  // How many users have reused this line
  lastUsedAt: Timestamp;
}
```

---

### `userScripts` (Root Collection)
User-specific script uploads and scene organization.

```typescript
{
  scriptId: string;
  userId: string;
  showId: string;  // Reference to shows collection
  showTitle: string;
  
  uploadedAt: Timestamp;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  
  // OCR and parsing
  totalScenes: number;
  processedScenes: number;
  
  scenes: {
    [sceneId: string]: {
      sceneNumber: number;
      sceneTitle?: string;  // e.g., "Act 1, Scene 2"
      imageUrl: string;  // Original uploaded image
      
      // OCR status
      ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
      ocrText?: string;  // Raw OCR output
      ocrConfidence?: number;
      
      // Parsed lines
      lines: {
        [lineId: string]: {
          characterName: string;
          text: string;
          lineNumber: number;  // Order within scene
          
          // Audio reference (points to show-level cache or user-specific)
          audioUrl?: string;
          audioStatus: 'pending' | 'generating' | 'completed' | 'failed';
          duration?: number;
          
          // Cache hit tracking
          cacheHit: boolean;  // true if reused from show cache
          showLineId?: string;  // Reference to shows/{showId}/lines/{lineId}
          
          generatedAt?: Timestamp;
        }
      };
    }
  };
}
```

---

### `voiceLibrary` (Root Collection)
Curated voice profiles for character assignment.

```typescript
{
  voiceId: string;
  voiceName: string;  // e.g., "Young Female - American"
  
  // Voice characteristics for auto-assignment
  gender: 'male' | 'female' | 'neutral';
  ageRange: 'child' | 'teen' | 'young_adult' | 'adult' | 'mature' | 'elderly';
  accent?: string;  // "American", "British", "Southern", etc.
  tone?: string;  // "Warm", "Authoritative", "Playful", etc.
  
  // VoxCPM parameters
  promptWavPath: string;  // Cloud Storage URL to reference audio
  promptText?: string;  // Text that was spoken in the prompt
  
  // Metadata
  createdAt: Timestamp;
  isActive: boolean;
  usageCount: number;  // How many characters use this voice
  
  // Tags for smart matching
  tags: string[];  // ["shakespeare", "villain", "hero", "comic_relief"]
}
```

---

## Key Algorithms

### 1. Line Deduplication (Fuzzy Matching)
```typescript
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
}

function findMatchingLine(
  showId: string,
  characterName: string,
  text: string
): Promise<CachedLine | null> {
  const normalized = normalizeText(text);
  const textHash = sha256(normalized);
  
  // 1. Try exact hash match first
  const exactMatch = await db
    .collection(`shows/${showId}/lines`)
    .where('textHash', '==', textHash)
    .where('normalizedCharacter', '==', normalizeText(characterName))
    .limit(1)
    .get();
  
  if (!exactMatch.empty) return exactMatch.docs[0].data();
  
  // 2. Fallback to fuzzy matching (Levenshtein distance < 10%)
  // (Implement client-side or use Algolia/Typesense for search)
  
  return null;
}
```

### 2. Voice Assignment Algorithm
```typescript
async function assignVoiceToCharacter(
  showId: string,
  characterName: string,
  showMetadata?: ShowMetadata
): Promise<VoiceProfile> {
  // 1. Check if character already has assigned voice
  const show = await db.collection('shows').doc(showId).get();
  const existingVoice = show.data()?.characterVoices?.[characterName];
  if (existingVoice) return existingVoice;
  
  // 2. Query voice library with filters
  let query = db.collection('voiceLibrary').where('isActive', '==', true);
  
  // Apply smart filters based on character name heuristics
  if (characterName.toLowerCase().includes('king') || 
      characterName.toLowerCase().includes('lord')) {
    query = query.where('tone', '==', 'Authoritative');
  }
  
  // 3. Get available voices and pick one not yet used in this show
  const voices = await query.get();
  const usedVoiceIds = new Set(
    Object.values(show.data()?.characterVoices || {}).map(v => v.voiceId)
  );
  
  const availableVoice = voices.docs.find(
    doc => !usedVoiceIds.has(doc.id)
  );
  
  if (!availableVoice) {
    throw new Error('No available voices in library');
  }
  
  // 4. Assign voice to character (atomic update)
  await db.collection('shows').doc(showId).update({
    [`characterVoices.${characterName}`]: {
      voiceId: availableVoice.id,
      voiceName: availableVoice.data().voiceName,
      assignedAt: FieldValue.serverTimestamp(),
      assignedBy: currentUserId,
    }
  });
  
  return availableVoice.data();
}
```

### 3. Audio Generation Workflow
```
1. User uploads script images
2. Cloud Function triggered on upload
3. OCR extracts text (Vision API)
4. Gemini parses dialogue vs. stage directions
5. For each line:
   a. Normalize text and character name
   b. Check show-level cache for match
   c. If cache hit: Copy audioUrl to userScript
   d. If cache miss:
      - Assign voice to character (if not assigned)
      - Queue TTS job to Modal
      - Store result in show-level cache
      - Link to userScript
6. Update userScript status as lines complete
```

---

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read/write their own scripts
    match /userScripts/{scriptId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
    
    // Show data is read-only for all authenticated users
    match /shows/{showId} {
      allow read: if request.auth != null;
      allow write: if false;  // Only Cloud Functions can write
    }
    
    match /shows/{showId}/lines/{lineId} {
      allow read: if request.auth != null;
      allow write: if false;  // Only Cloud Functions can write
    }
    
    // Voice library is read-only
    match /voiceLibrary/{voiceId} {
      allow read: if request.auth != null;
      allow write: if false;  // Admin only
    }
  }
}
```

---

## Cost Optimization

**Estimated savings with caching:**
- Without caching: 50 lines × 10 cast members = 500 TTS requests
- With caching: 50 lines × 1 generation = 50 TTS requests
- **Savings: 90% reduction in TTS costs**

**Example:**
- Hamilton has ~20,000 words of dialogue
- ~2,000 unique lines across all characters
- First cast member: $0.50 (full generation)
- Each additional cast member: $0.05 (only new/different lines)

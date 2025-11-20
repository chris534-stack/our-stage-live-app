# Voice Library Sources for VoxCPM

## Best Free Sources

### 1. LibriVox (Recommended)
**URL:** https://librivox.org/

**Why it's perfect:**
- Public domain audiobooks
- Professional-quality recordings
- Diverse voices (age, gender, accent)
- Theatrical readings (Shakespeare, classics)

**How to use:**
1. Browse by genre: https://librivox.org/search?primary_key=0&search_category=genre&search_page=1&search_form=get_results
2. Look for:
   - **Drama** - Shakespeare, Greek tragedies
   - **Poetry** - Expressive readings
   - **Fiction** - Character voices
3. Download MP3 files
4. Extract 5-10 second clips per voice

**Recommended audiobooks:**
- **Hamlet** - Multiple character voices
- **Romeo and Juliet** - Young romantic leads
- **Julius Caesar** - Authority figures
- **A Midsummer Night's Dream** - Comedic voices

### 2. Internet Archive Audio
**URL:** https://archive.org/details/audio

**What to search:**
- "dramatic reading"
- "Shakespeare"
- "theatrical performance"
- Filter by: Public Domain

### 3. Freesound (Creative Commons)
**URL:** https://freesound.org/

**Search terms:**
- "voice acting"
- "character voice"
- "dramatic reading"
- Check license (CC0 or CC-BY)

## Voice Sample Specifications

**For VoxCPM:**
- **Length:** 5-10 seconds (minimum 3 seconds)
- **Quality:** 16kHz+ sample rate, clear audio
- **Format:** WAV or MP3
- **Content:** Natural speech, not singing
- **Clean:** No background music or noise

**Enable "Prompt Speech Enhancement" in VoxCPM to clean up:**
- Background noise
- Hiss/rumble
- Room echo

## Sample Extraction Workflow

### Using Audacity (Free)

1. **Download LibriVox audiobook**
2. **Open in Audacity**
3. **Find good voice samples:**
   - Listen for expressive dialogue
   - Look for emotional variety
   - Find clean sections (no music/effects)
4. **Extract 10-second clips:**
   - Select region
   - File > Export > Export Selected Audio
   - Save as WAV (16-bit PCM, 24kHz)
5. **Normalize:**
   - Effect > Normalize
   - Remove DC offset: Yes
   - Normalize to: -3.0 dB

### Using ffmpeg (Command line)

```bash
# Extract 10 seconds starting at 1:30
ffmpeg -i input.mp3 -ss 00:01:30 -t 10 -ar 24000 output.wav

# Normalize volume
ffmpeg -i input.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" output_normalized.wav
```

## Curated Voice Library Structure

```
voices/
├── young_male_hero/
│   ├── hamlet_1.wav (LibriVox - Hamlet Act 3)
│   ├── romeo_1.wav (LibriVox - Romeo & Juliet)
│   └── metadata.json
├── young_female_ingenue/
│   ├── juliet_1.wav
│   ├── ophelia_1.wav
│   └── metadata.json
├── mature_male_authority/
│   ├── claudius_1.wav
│   ├── caesar_1.wav
│   └── metadata.json
└── ...
```

**metadata.json example:**
```json
{
  "voiceId": "young_male_hero_hamlet",
  "source": "LibriVox - Hamlet",
  "reader": "John Doe",
  "promptText": "To be, or not to be, that is the question.",
  "duration": 8.5,
  "sampleRate": 24000,
  "license": "Public Domain"
}
```

## Quick Start: 12 Voice Library

**Download these LibriVox recordings:**
1. Hamlet - https://librivox.org/hamlet-by-william-shakespeare/
2. Romeo and Juliet - https://librivox.org/romeo-and-juliet-by-william-shakespeare-1597/
3. Julius Caesar - https://librivox.org/julius-caesar-by-william-shakespeare-6/
4. A Midsummer Night's Dream - https://librivox.org/a-midsummer-nights-dream-by-william-shakespeare-3/

**Extract clips for:**
- Young male (Romeo, Hamlet)
- Young female (Juliet, Ophelia)
- Mature male (Claudius, Caesar)
- Mature female (Gertrude, Lady Capulet)
- Comedic (Puck, Bottom)
- Villain (Iago, Lady Macbeth)
- Elderly (Polonius, Friar Lawrence)

## Upload to Firebase

```typescript
// Upload voice sample
const storageRef = ref(storage, `voice-library/${voiceId}.wav`);
await uploadBytes(storageRef, audioFile);
const audioUrl = await getDownloadURL(storageRef);

// Save to Firestore
await setDoc(doc(db, 'voiceLibrary', voiceId), {
  voiceId,
  audioUrl,
  promptText: "Sample text from the clip",
  source: "LibriVox - Hamlet",
  gender: "male",
  ageRange: "young",
  archetype: "hero",
  createdAt: new Date(),
});
```

## Cost Comparison

**VoxCPM with voice library:**
- Setup: 1-2 hours to curate 12 voices
- Cost: $0.42 per 150-line script
- Quality: ⭐⭐⭐⭐⭐ (Excellent with prompts)

**Gemini TTS:**
- Setup: None (pre-built voices)
- Cost: $0.005 per script
- Quality: ⭐⭐⭐ (Good but not context-aware)

**Google TTS:**
- Setup: None
- Cost: $0.06 per script
- Quality: ⭐⭐ (Robotic)

## Next Steps

1. Download 2-3 LibriVox audiobooks
2. Extract 12 voice samples (10 seconds each)
3. Upload to Firebase Storage
4. Test with VoxCPM on Modal
5. Compare quality with Gemini TTS

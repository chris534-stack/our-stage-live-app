# Gemini 2.5 Native Audio TTS Setup

## What You're Using

**Gemini 2.5 Flash with Native Audio** - The same model from Vertex AI Media Playground!

- ✅ Controllable text-to-speech with natural language prompts
- ✅ Expressive, human-like voices
- ✅ Dynamic performance (emotions, accents, tone)
- ✅ Multi-speaker dialogue capability
- ✅ SynthID watermarking for transparency

## Step 1: Install Package

```bash
npm install @google-cloud/vertexai
```

## Step 2: Enable Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com
```

## Step 3: Authentication

Your project already has Firebase credentials - Vertex AI will use the same service account automatically!

**No additional setup needed.**

## Step 4: Pricing

**Gemini 2.5 Flash (Recommended):**
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- **Audio output**: Included in output pricing

**Estimated cost per script:**
- 150 lines × ~100 tokens = 15,000 tokens
- Output cost: 15,000 × $0.30 / 1M = **$0.0045** (~half a cent!)
- **Much cheaper than VoxCPM ($0.42) and Google TTS ($0.06)**

**Free tier:**
- Gemini 2.5 Flash: Generous free quota
- **~1,000+ scripts/month free**

## Voice Library

We use **natural language prompts** to control Gemini's voice:

```typescript
{
  voiceId: 'young_male_hero',
  prompt: 'Speak in a strong, confident young male voice. Sound like a heroic man in his mid-twenties with earnest conviction and natural charisma.'
}
```

**12 Theatrical Archetypes:**
1. Young Female Ingenue
2. Young Male Hero
3. Young Female Confident
4. Comedic Male
5. Comedic Female
6. Mature Male Authority
7. Mature Female Authority
8. Villain Male
9. Villain Female
10. Elderly Male Wise
11. Elderly Female Wise
12. Child Female

## API Endpoint

**POST** `/api/tts/synthesize`

```json
{
  "text": "To be, or not to be, that is the question.",
  "voiceId": "young_male_hero",
  "showId": "hamlet-2024",
  "characterName": "Hamlet"
}
```

**Response:**
```json
{
  "audioUrl": "https://storage.googleapis.com/...",
  "cached": false,
  "duration": 3.5,
  "fileSize": 45678
}
```

## Advantages Over Other Options

| Feature | Gemini 2.5 | Google TTS | VoxCPM |
|---------|------------|------------|---------|
| **Cost/script** | $0.005 | $0.06 | $0.42 |
| **Quality** | ✅ Excellent | ✅ Good | ✅ Excellent |
| **Expressiveness** | ✅ High | ⚠️ Moderate | ✅ High |
| **Consistency** | ✅ Perfect | ✅ Perfect | ❌ Needs prompts |
| **Speed** | ✅ Fast (~2s) | ✅ Instant | ❌ Slow (15s) |
| **Voice control** | ✅ Natural language | ❌ Fixed voices | ✅ Voice cloning |
| **Customization** | ✅ Unlimited | ❌ Limited | ✅ High |

## Natural Language Voice Control

Gemini can adapt voices on-the-fly with prompts:

```typescript
// Angry Hamlet
prompt: "Speak in an angry, frustrated tone. Sound furious and betrayed."

// Whispering Juliet
prompt: "Whisper softly and romantically. Sound like you're sharing a secret."

// Elderly King Lear
prompt: "Speak in a weathered, elderly voice with deep sadness and madness creeping in."
```

## Next Steps

1. Install package: `npm install @google-cloud/vertexai`
2. Enable API: `gcloud services enable aiplatform.googleapis.com`
3. Test the endpoint
4. Integrate with frontend

## Testing

Create a test file:

```typescript
// test-gemini-tts.ts
import { generateGeminiSpeech, GEMINI_VOICE_LIBRARY } from '@/lib/gemini-tts';
import fs from 'fs';

async function test() {
  const voice = GEMINI_VOICE_LIBRARY[1]; // Young Male Hero
  
  const audio = await generateGeminiSpeech(
    "To be, or not to be, that is the question.",
    voice.prompt
  );
  
  fs.writeFileSync('test-gemini.mp3', audio);
  console.log('✅ Generated test-gemini.mp3');
}

test();
```

## Production Ready

- ✅ Firestore caching (instant for repeated lines)
- ✅ Firebase Storage upload
- ✅ Character voice matching
- ✅ Show-level audio sharing
- ✅ Cost-effective ($0.005 per script)
- ✅ High quality, expressive voices
- ✅ Same voices you tested in Vertex AI playground!

# Google Cloud Text-to-Speech Setup

## Step 1: Install Package

```bash
npm install @google-cloud/text-to-speech
```

## Step 2: Enable API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: `our-stage-eugene-w930o`
3. Enable **Cloud Text-to-Speech API**:
   ```bash
   gcloud services enable texttospeech.googleapis.com
   ```

## Step 3: Set Up Authentication

Your project already has Firebase Admin SDK credentials. The Text-to-Speech API will use the same service account.

**No additional setup needed!** The API will automatically use your existing Firebase credentials.

## Step 4: Test the Integration

Create a test script:

```typescript
// test-google-tts.ts
import { generateSpeech, THEATRICAL_VOICE_LIBRARY } from '@/lib/google-tts';
import fs from 'fs';

async function test() {
  const voice = THEATRICAL_VOICE_LIBRARY[0]; // Young Female Ingenue
  
  const audio = await generateSpeech(
    "To be, or not to be, that is the question.",
    voice.voiceId
  );
  
  fs.writeFileSync('test-google-tts.mp3', audio);
  console.log('✅ Generated test-google-tts.mp3');
}

test();
```

## Step 5: Pricing

**Google Cloud TTS Pricing:**
- WaveNet voices: $16 per 1 million characters
- Neural2 voices: $16 per 1 million characters
- **Free tier**: 1 million characters per month

**Your usage:**
- 150-line script ≈ 15,000 characters
- **Cost**: $0.24 per script
- **Free tier**: ~66 scripts/month

**Much cheaper than VoxCPM!**

## Voice Library

We've curated 12 theatrical voices:

| Voice ID | Character Type | Gender | Age |
|----------|---------------|--------|-----|
| en-US-Neural2-C | Young Female Ingenue | F | Young |
| en-US-Neural2-E | Young Female Hero | F | Young |
| en-US-Neural2-G | Young Female Comedic | F | Young |
| en-US-Neural2-A | Young Male Hero | M | Young |
| en-US-Neural2-I | Young Male Comedic | M | Young |
| en-US-Neural2-F | Mature Female Authority | F | Mature |
| en-US-Neural2-H | Mature Female Villain | F | Mature |
| en-US-Neural2-D | Mature Male Authority | M | Mature |
| en-US-Neural2-J | Mature Male Villain | M | Mature |
| en-GB-Neural2-A | Elderly Female Wise | F | Elderly |
| en-GB-Neural2-B | Elderly Male Wise | M | Elderly |
| en-US-Wavenet-F | Child Female | F | Child |

## API Endpoint

**POST** `/api/tts/synthesize`

```json
{
  "text": "To be, or not to be, that is the question.",
  "voiceId": "en-US-Neural2-A",
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

## Caching Strategy

Audio is cached in Firestore at:
```
shows/{showId}/audioCache/{textHash}
```

- First generation: ~1 second
- Cached requests: Instant
- Shared across all users of the same show
- **90% cost reduction** for popular shows

## Next Steps

1. Enable the API
2. Install the package
3. Test the endpoint
4. Integrate with frontend

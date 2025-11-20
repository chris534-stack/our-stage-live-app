# Gemini TTS API Key Setup

## Get Your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Get API Key"
3. Create a new API key for your project
4. Copy the API key

## Add to Environment Variables

Create or update `.env.local`:

```bash
GOOGLE_API_KEY=your_api_key_here
```

## Test the Integration

```bash
npx tsx test-gemini-tts-correct.ts
```

This will generate 3 Shakespeare samples with:
- ✅ Context-aware generation
- ✅ Prompt-controlled tone and emotion
- ✅ Natural prosody
- ✅ Much better than Google TTS!

## Pricing

**Gemini 2.5 Flash TTS:**
- Input: $0.075 per 1M tokens
- Output (audio): $0.30 per 1M tokens
- **~$0.005 per 150-line script**
- **Much cheaper than VoxCPM ($0.42)**

## Next Steps

Once you verify the quality is good, we'll:
1. Update the API route to use this
2. Integrate with Firestore caching
3. Connect to frontend

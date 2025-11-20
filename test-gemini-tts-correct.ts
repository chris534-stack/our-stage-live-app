/**
 * Test Gemini 2.5 Flash TTS (Correct Implementation)
 * Uses gemini-2.5-flash-preview-tts with prompt control
 */

import { generateGeminiTTSWithMetadata, GEMINI_TTS_VOICES } from './src/lib/gemini-tts-correct';
import fs from 'fs';
import path from 'path';
import wav from 'wav';

async function testGeminiTTS() {
  console.log('=' .repeat(60));
  console.log('TESTING GEMINI 2.5 FLASH TTS (WITH PROMPT CONTROL)');
  console.log('=' .repeat(60));
  
  // Create output directory
  const outputDir = path.join(process.cwd(), 'test-audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  // Test 3 different voices with Shakespeare
  const testCases = [
    {
      voice: GEMINI_TTS_VOICES[1], // Young Male Hero
      text: "To be, or not to be, that is the question. Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune.",
    },
    {
      voice: GEMINI_TTS_VOICES[0], // Young Female Ingenue
      text: "O Romeo, Romeo! Wherefore art thou Romeo? Deny thy father and refuse thy name, or if thou wilt not, be but sworn my love.",
    },
    {
      voice: GEMINI_TTS_VOICES[5], // Mature Male Authority
      text: "Friends, Romans, countrymen, lend me your ears. I come to bury Caesar, not to praise him.",
    },
  ];
  
  console.log(`\nGenerating ${testCases.length} test audio files...\n`);
  
  for (let i = 0; i < testCases.length; i++) {
    const { voice, text } = testCases[i];
    
    console.log(`[${i + 1}/${testCases.length}] ${voice.description}`);
    console.log(`  Voice: ${voice.voiceName}`);
    console.log(`  Style: ${voice.promptStyle}`);
    console.log(`  Text: "${text.substring(0, 60)}..."`);
    
    try {
      const startTime = Date.now();
      
      const result = await generateGeminiTTSWithMetadata(text, voice);
      
      const duration = (Date.now() - startTime) / 1000;
      
      // Save as proper WAV file with header
      const filename = path.join(outputDir, `gemini_tts_${voice.voiceId}.wav`);
      
      // Write WAV header (24kHz, 16-bit, mono)
      const writer = new wav.FileWriter(filename, {
        channels: 1,
        sampleRate: 24000,
        bitDepth: 16,
      });
      
      writer.write(result.audioBuffer);
      writer.end();
      
      console.log(`  ✅ Generated in ${duration.toFixed(1)}s`);
      console.log(`  📁 Saved: ${filename}`);
      console.log(`  📊 Size: ${(result.audioBuffer.length / 1024).toFixed(1)} KB`);
      
      if (result.usage && result.cost) {
        console.log(`  💰 Cost: $${result.cost.totalCost.toFixed(6)}`);
        console.log(`     Input: ${result.usage.inputTokens} tokens ($${result.cost.inputCost.toFixed(6)})`);
        console.log(`     Output: ${result.usage.outputTokens} tokens ($${result.cost.outputCost.toFixed(6)})`);
      }
      console.log();
      
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  }
  
  console.log('=' .repeat(60));
  console.log('TEST COMPLETE');
  console.log('=' .repeat(60));
  console.log(`\n📁 Audio files saved to: ${outputDir}`);
  console.log('\n🎧 This should sound MUCH better than Google TTS:');
  console.log('  ✅ Context-aware (understands the text)');
  console.log('  ✅ Prompt-controlled (tone, emotion, style)');
  console.log('  ✅ Natural prosody and expression');
  console.log('\n💰 Cost: ~$0.001 per test (very cheap)');
  console.log('📊 Speed: ~2-3 seconds per line');
}

testGeminiTTS().catch(console.error);

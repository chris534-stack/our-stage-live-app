/**
 * Test Gemini 2.5 Native Audio TTS
 * Generates sample audio with theatrical voices
 */

import { generateGeminiSpeech, GEMINI_VOICE_LIBRARY } from './src/lib/gemini-tts';
import fs from 'fs';
import path from 'path';

async function testGeminiTTS() {
  console.log('=' .repeat(60));
  console.log('TESTING GEMINI 2.5 NATIVE AUDIO TTS');
  console.log('=' .repeat(60));
  
  // Create output directory
  const outputDir = path.join(process.cwd(), 'test-audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  // Test 3 different voices with Shakespeare
  const testCases = [
    {
      voice: GEMINI_VOICE_LIBRARY[1], // Young Male Hero
      text: "To be, or not to be, that is the question. Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune.",
    },
    {
      voice: GEMINI_VOICE_LIBRARY[0], // Young Female Ingenue
      text: "O Romeo, Romeo! Wherefore art thou Romeo? Deny thy father and refuse thy name, or if thou wilt not, be but sworn my love.",
    },
    {
      voice: GEMINI_VOICE_LIBRARY[5], // Mature Male Authority
      text: "Friends, Romans, countrymen, lend me your ears. I come to bury Caesar, not to praise him.",
    },
  ];
  
  console.log(`\nGenerating ${testCases.length} test audio files...\n`);
  
  for (let i = 0; i < testCases.length; i++) {
    const { voice, text } = testCases[i];
    
    console.log(`[${i + 1}/${testCases.length}] ${voice.name}`);
    console.log(`  Text: "${text.substring(0, 60)}..."`);
    console.log(`  Prompt: "${voice.prompt.substring(0, 60)}..."`);
    
    try {
      const startTime = Date.now();
      
      const audioBuffer = await generateGeminiSpeech(text, voice.prompt);
      
      const duration = (Date.now() - startTime) / 1000;
      const filename = path.join(outputDir, `gemini_${voice.voiceId}.mp3`);
      
      fs.writeFileSync(filename, audioBuffer);
      
      console.log(`  ✅ Generated in ${duration.toFixed(1)}s`);
      console.log(`  📁 Saved: ${filename}`);
      console.log(`  📊 Size: ${(audioBuffer.length / 1024).toFixed(1)} KB\n`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  }
  
  console.log('=' .repeat(60));
  console.log('TEST COMPLETE');
  console.log('=' .repeat(60));
  console.log(`\n📁 Audio files saved to: ${outputDir}`);
  console.log('\n🎧 Listen to the files to verify:');
  console.log('  1. Voice quality and naturalness');
  console.log('  2. Each voice sounds distinct');
  console.log('  3. Appropriate emotion and tone');
  console.log('\n💡 If quality is good, we can proceed with frontend integration!');
}

testGeminiTTS().catch(console.error);

/**
 * Test Google Cloud Text-to-Speech
 * Quick test to hear the quality
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';

const client = new TextToSpeechClient();

async function testGoogleTTS() {
  console.log('=' .repeat(60));
  console.log('TESTING GOOGLE CLOUD TEXT-TO-SPEECH');
  console.log('=' .repeat(60));
  
  // Create output directory
  const outputDir = path.join(process.cwd(), 'test-audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  // Test 3 different Neural2 voices with Shakespeare
  const testCases = [
    {
      name: 'Young Male Hero (Neural2-D)',
      voiceId: 'en-US-Neural2-D',
      text: "To be, or not to be, that is the question. Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune.",
    },
    {
      name: 'Young Female Ingenue (Neural2-C)',
      voiceId: 'en-US-Neural2-C',
      text: "O Romeo, Romeo! Wherefore art thou Romeo? Deny thy father and refuse thy name, or if thou wilt not, be but sworn my love.",
    },
    {
      name: 'Mature Male Authority (Neural2-A)',
      voiceId: 'en-US-Neural2-A',
      text: "Friends, Romans, countrymen, lend me your ears. I come to bury Caesar, not to praise him.",
    },
  ];
  
  console.log(`\nGenerating ${testCases.length} test audio files...\n`);
  
  for (let i = 0; i < testCases.length; i++) {
    const { name, voiceId, text } = testCases[i];
    
    console.log(`[${i + 1}/${testCases.length}] ${name}`);
    console.log(`  Voice: ${voiceId}`);
    console.log(`  Text: "${text.substring(0, 60)}..."`);
    
    try {
      const startTime = Date.now();
      
      const request = {
        input: { text },
        voice: {
          languageCode: 'en-US',
          name: voiceId,
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: 1.0,
          pitch: 0,
        },
      };

      const [response] = await client.synthesizeSpeech(request);
      
      if (!response.audioContent) {
        throw new Error('No audio content received');
      }

      const duration = (Date.now() - startTime) / 1000;
      const audioBuffer = Buffer.from(response.audioContent);
      const filename = path.join(outputDir, `google_tts_${voiceId}.mp3`);
      
      fs.writeFileSync(filename, audioBuffer);
      
      console.log(`  ✅ Generated in ${duration.toFixed(2)}s`);
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
  console.log('\n🎧 Listen to compare with what you heard in Vertex AI playground');
  console.log('\n💰 Cost: ~$0.0001 (essentially free for this test)');
  console.log('📊 Speed: Instant generation (< 1 second per line)');
}

testGoogleTTS().catch(console.error);

/**
 * Test Gemini 2.5 Pro TTS with modern, conversational monologue
 * Tests versatility with contemporary language
 */

import { generateGeminiTTSWithMetadata, GEMINI_TTS_VOICES } from './src/lib/gemini-tts-correct';
import fs from 'fs';
import path from 'path';
import wav from 'wav';

// Modern monologue - inspired by contemporary public domain works
// This is a realistic, conversational piece about everyday life
const MODERN_MONOLOGUE = `Look, I'm not saying I'm perfect. Far from it, actually. 
But here's the thing - nobody tells you how hard it gets when you're trying to figure out who you are. 
They don't mention that in the brochure, you know? 
Like, one day you're just living your life, going through the motions, and then suddenly you wake up and think, 
"Wait, is this really what I want? Is this who I'm supposed to be?"

And the worst part? Everyone around you seems to have it all figured out. 
They've got their careers, their relationships, their five-year plans. 
Meanwhile, I'm over here just trying to decide what to have for breakfast without having an existential crisis about it.

But maybe that's okay. Maybe not knowing is part of the process. 
Maybe we're all just making it up as we go along, pretending we know what we're doing. 
And honestly? That's kind of comforting in a weird way.`;

/**
 * Segment text into natural conversational chunks
 */
function segmentMonologue(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const segments: string[] = [];
  let currentSegment = '';
  
  for (const sentence of sentences) {
    const testSegment = currentSegment + (currentSegment ? ' ' : '') + sentence;
    const wordCount = testSegment.split(/\s+/).length;
    
    if (wordCount < 80) {
      currentSegment = testSegment;
    } else {
      if (currentSegment) segments.push(currentSegment);
      currentSegment = sentence;
    }
  }
  
  if (currentSegment) segments.push(currentSegment);
  return segments;
}

function stitchAudioBuffers(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

async function testModernMonologue() {
  console.log('=' .repeat(70));
  console.log('TESTING GEMINI 2.5 PRO TTS - MODERN CONVERSATIONAL MONOLOGUE');
  console.log('=' .repeat(70));
  
  const outputDir = path.join(process.cwd(), 'test-audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  // Test with different voices to show versatility
  const testVoices = [
    {
      voice: GEMINI_TTS_VOICES[2], // Young Female Confident
      filename: 'modern_monologue_female.wav',
      description: 'Young woman reflecting on life'
    },
    {
      voice: GEMINI_TTS_VOICES[4], // Comedic Male
      filename: 'modern_monologue_comedic.wav',
      description: 'Humorous, self-deprecating delivery'
    }
  ];
  
  for (const test of testVoices) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📝 Testing: ${test.description}`);
    console.log(`🎭 Voice: ${test.voice.description} (${test.voice.voiceName})`);
    console.log(`📊 Total length: ${MODERN_MONOLOGUE.split(/\s+/).length} words`);
    
    const segments = segmentMonologue(MODERN_MONOLOGUE);
    console.log(`\n✂️  Segmented into ${segments.length} parts:`);
    segments.forEach((seg, i) => {
      const wordCount = seg.split(/\s+/).length;
      console.log(`   Part ${i + 1}: ${wordCount} words - "${seg.substring(0, 50)}..."`);
    });
    
    console.log(`\n🎙️  Generating audio segments...\n`);
    
    const audioBuffers: Buffer[] = [];
    const startTime = Date.now();
    let totalCost = 0;
    let totalTokens = 0;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      console.log(`[${i + 1}/${segments.length}] Generating segment...`);
      
      try {
        const segmentStart = Date.now();
        const result = await generateGeminiTTSWithMetadata(segment, test.voice);
        const duration = (Date.now() - segmentStart) / 1000;
        
        audioBuffers.push(result.audioBuffer);
        
        if (result.cost) {
          totalCost += result.cost.totalCost;
        }
        if (result.usage) {
          totalTokens += result.usage.totalTokens;
        }
        
        console.log(`  ✅ Generated in ${duration.toFixed(1)}s (${(result.audioBuffer.length / 1024).toFixed(1)} KB)`);
        if (result.cost) {
          console.log(`  💰 Cost: $${result.cost.totalCost.toFixed(6)} (${result.usage?.totalTokens} tokens)\n`);
        }
        
      } catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        continue;
      }
    }
    
    // Stitch segments together
    console.log(`🔗 Stitching ${audioBuffers.length} segments together...`);
    const finalAudio = stitchAudioBuffers(audioBuffers);
    
    // Save as WAV
    const filename = path.join(outputDir, test.filename);
    const writer = new wav.FileWriter(filename, {
      channels: 1,
      sampleRate: 24000,
      bitDepth: 16,
    });
    
    writer.write(finalAudio);
    writer.end();
    
    const totalDuration = (Date.now() - startTime) / 1000;
    
    console.log(`\n✅ Completed: ${test.description}`);
    console.log(`📁 Saved to: ${filename}`);
    console.log(`📊 Final size: ${(finalAudio.length / 1024).toFixed(1)} KB`);
    console.log(`⏱️  Total time: ${totalDuration.toFixed(1)}s`);
    console.log(`\n💰 ACTUAL API COST:`);
    console.log(`   Total: $${totalCost.toFixed(6)}`);
    console.log(`   Tokens: ${totalTokens}`);
    console.log(`   Per word: $${(totalCost / MODERN_MONOLOGUE.split(/\s+/).length).toFixed(6)}`);
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('ALL TESTS COMPLETE');
  console.log('=' .repeat(70));
  console.log(`\n🎧 Listen to both versions to compare:`);
  console.log(`   1. Female confident voice - Serious, reflective`);
  console.log(`   2. Comedic male voice - Humorous, self-aware`);
  console.log(`\n💡 This shows how the same text sounds completely different`);
  console.log(`   with different voice styles and prompts!`);
}

testModernMonologue().catch(console.error);

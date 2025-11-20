/**
 * Test Gemini 2.5 Pro TTS with full Shakespearean monologue
 * Handles segmentation and stitching for long text
 */

import { generateGeminiTTSWithMetadata, GEMINI_TTS_VOICES } from './src/lib/gemini-tts-correct';
import fs from 'fs';
import path from 'path';
import wav from 'wav';

// Hamlet's "To be or not to be" - Full monologue
const HAMLET_MONOLOGUE = `To be, or not to be, that is the question:
Whether 'tis nobler in the mind to suffer
The slings and arrows of outrageous fortune,
Or to take arms against a sea of troubles
And by opposing end them. To die—to sleep,
No more; and by a sleep to say we end
The heart-ache and the thousand natural shocks
That flesh is heir to: 'tis a consummation
Devoutly to be wish'd. To die, to sleep;
To sleep, perchance to dream—ay, there's the rub:
For in that sleep of death what dreams may come,
When we have shuffled off this mortal coil,
Must give us pause—there's the respect
That makes calamity of so long life.`;

/**
 * Segment text into chunks that fit within token limits
 * Aim for ~50-100 words per segment for natural breaks
 */
function segmentMonologue(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;:])\s+/);
  const segments: string[] = [];
  let currentSegment = '';
  
  for (const sentence of sentences) {
    const testSegment = currentSegment + (currentSegment ? ' ' : '') + sentence;
    const wordCount = testSegment.split(/\s+/).length;
    
    // Keep segments under 80 words for natural phrasing
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

/**
 * Stitch multiple WAV buffers together
 */
function stitchAudioBuffers(buffers: Buffer[]): Buffer {
  // Simply concatenate the PCM data (all same format: 24kHz, 16-bit, mono)
  return Buffer.concat(buffers);
}

async function testMonologue() {
  console.log('=' .repeat(70));
  console.log('TESTING GEMINI 2.5 PRO TTS - FULL SHAKESPEAREAN MONOLOGUE');
  console.log('=' .repeat(70));
  
  const outputDir = path.join(process.cwd(), 'test-audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  const voice = GEMINI_TTS_VOICES[7]; // Villain Male (Enceladus) - Breathy, mysterious
  
  console.log(`\n📝 Monologue: Hamlet's "To be, or not to be"`);
  console.log(`🎭 Voice: ${voice.description} (${voice.voiceName})`);
  console.log(`📊 Total length: ${HAMLET_MONOLOGUE.split(/\s+/).length} words`);
  
  // Segment the monologue
  const segments = segmentMonologue(HAMLET_MONOLOGUE);
  console.log(`\n✂️  Segmented into ${segments.length} parts for optimal generation:`);
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
      const result = await generateGeminiTTSWithMetadata(segment, voice);
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
      return;
    }
  }
  
  // Stitch segments together
  console.log(`🔗 Stitching ${audioBuffers.length} segments together...`);
  const finalAudio = stitchAudioBuffers(audioBuffers);
  
  // Save as WAV
  const filename = path.join(outputDir, 'hamlet_monologue_full.wav');
  const writer = new wav.FileWriter(filename, {
    channels: 1,
    sampleRate: 24000,
    bitDepth: 16,
  });
  
  writer.write(finalAudio);
  writer.end();
  
  const totalDuration = (Date.now() - startTime) / 1000;
  
  console.log('\n' + '=' .repeat(70));
  console.log('MONOLOGUE GENERATION COMPLETE');
  console.log('=' .repeat(70));
  console.log(`\n✅ Full monologue generated successfully!`);
  console.log(`📁 Saved to: ${filename}`);
  console.log(`📊 Final size: ${(finalAudio.length / 1024).toFixed(1)} KB`);
  console.log(`⏱️  Total time: ${totalDuration.toFixed(1)}s`);
  console.log(`\n💰 ACTUAL API COST:`);
  console.log(`   Total: $${totalCost.toFixed(6)}`);
  console.log(`   Tokens: ${totalTokens}`);
  console.log(`   Per word: $${(totalCost / HAMLET_MONOLOGUE.split(/\s+/).length).toFixed(6)}`);
  console.log(`\n🎧 Listen to verify:`);
  console.log(`   - Natural flow between segments`);
  console.log(`   - Consistent voice throughout`);
  console.log(`   - Emotional progression (villain voice!)`);
  console.log(`   - No audible seams/cuts`);
}

testMonologue().catch(console.error);

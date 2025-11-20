/**
 * Convert Gemini TTS WAV files to MP3 for playback
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const testAudioDir = path.join(process.cwd(), 'test-audio');

// Find all gemini_tts WAV files
const files = fs.readdirSync(testAudioDir)
  .filter(f => f.startsWith('gemini_tts_') && f.endsWith('.wav'));

console.log(`Found ${files.length} WAV files to convert...\n`);

for (const file of files) {
  const inputPath = path.join(testAudioDir, file);
  const outputPath = inputPath.replace('.wav', '.mp3');
  
  console.log(`Converting: ${file}`);
  
  try {
    // Use ffmpeg to convert (if available)
    execSync(`ffmpeg -i "${inputPath}" -codec:a libmp3lame -qscale:a 2 "${outputPath}" -y`, {
      stdio: 'ignore'
    });
    console.log(`  ✅ Saved: ${path.basename(outputPath)}\n`);
  } catch (error) {
    console.log(`  ❌ ffmpeg not found - keeping WAV format\n`);
    console.log(`  💡 Install ffmpeg to convert: https://ffmpeg.org/download.html\n`);
    break;
  }
}

console.log('Done! Try playing the MP3 files.');

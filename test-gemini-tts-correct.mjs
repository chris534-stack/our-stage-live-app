/**
 * Test wrapper that loads .env.local before running the test
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env.local') });

// Check if API key is loaded
if (!process.env.GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_API_KEY not found in .env.local');
  console.error('Please make sure .env.local contains: GOOGLE_API_KEY=your_key_here');
  process.exit(1);
}

console.log('✅ API key loaded from .env.local');
console.log('');

// Run the actual test with the environment variable
execSync('npx tsx test-gemini-tts-correct.ts', {
  stdio: 'inherit',
  env: { ...process.env },
});

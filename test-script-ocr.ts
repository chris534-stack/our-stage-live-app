/**
 * Test Script OCR with Gemini Vision
 * Tests intelligent script extraction with cost tracking
 */

import { processScriptImage, processScriptImages } from './src/lib/script-ocr';
import fs from 'fs';
import path from 'path';

// Sample script text to test (you can replace with actual script image)
const SAMPLE_SCRIPT_PATH = process.argv[2]; // Pass image path as argument

async function testScriptOCR() {
  console.log('=' .repeat(70));
  console.log('TESTING GEMINI VISION SCRIPT OCR');
  console.log('=' .repeat(70));

  if (!SAMPLE_SCRIPT_PATH) {
    console.log('\n❌ No image path provided!');
    console.log('\nUsage:');
    console.log('  node -e "require(\'dotenv\').config({path:\'.env.local\'}); require(\'child_process\').execSync(\'npx tsx test-script-ocr.ts path/to/script-image.jpg\', {stdio:\'inherit\', env:process.env})"');
    console.log('\nOr create a test image first:');
    console.log('  1. Take a photo of a script page');
    console.log('  2. Save it as test-audio/sample-script.jpg');
    console.log('  3. Run: npx tsx test-script-ocr.ts test-audio/sample-script.jpg');
    return;
  }

  const imagePath = path.resolve(SAMPLE_SCRIPT_PATH);

  if (!fs.existsSync(imagePath)) {
    console.log(`\n❌ Image not found: ${imagePath}`);
    return;
  }

  console.log(`\n📄 Processing script image: ${path.basename(imagePath)}`);
  console.log(`📊 File size: ${(fs.statSync(imagePath).size / 1024).toFixed(1)} KB\n`);

  try {
    const startTime = Date.now();

    // Read image file
    const imageBuffer = fs.readFileSync(imagePath);
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Process with Gemini Vision
    const result = await processScriptImage(imageBuffer, mimeType);

    const duration = (Date.now() - startTime) / 1000;

    console.log('=' .repeat(70));
    console.log('OCR RESULTS');
    console.log('=' .repeat(70));

    // Scenes found
    console.log(`\n📋 Scenes Found: ${result.scenes.length}`);
    result.scenes.forEach((scene, i) => {
      console.log(`\n  Scene ${i + 1}: ${scene.sceneNumber}`);
      if (scene.sceneHeading) {
        console.log(`  Heading: ${scene.sceneHeading}`);
      }
      console.log(`  Lines: ${scene.lines.length}`);
      
      // Show first few lines as preview
      const preview = scene.lines.slice(0, 3);
      preview.forEach(line => {
        console.log(`    ${line.character}: "${line.dialogue.substring(0, 60)}${line.dialogue.length > 60 ? '...' : ''}"`);
      });
      if (scene.lines.length > 3) {
        console.log(`    ... and ${scene.lines.length - 3} more lines`);
      }
    });

    // Characters found
    console.log(`\n👥 Characters Found: ${result.characters.length}`);
    result.characters.forEach(char => {
      const lineCount = result.scenes.reduce((sum, scene) => 
        sum + scene.lines.filter(l => l.character === char).length, 0
      );
      console.log(`  - ${char} (${lineCount} lines)`);
    });

    // Statistics
    console.log(`\n📊 Statistics:`);
    console.log(`  Total Lines: ${result.totalLines}`);
    console.log(`  Processing Time: ${duration.toFixed(1)}s`);

    // Cost breakdown
    if (result.cost) {
      console.log(`\n💰 API COST:`);
      console.log(`  Input Tokens: ${result.cost.inputTokens.toLocaleString()}`);
      console.log(`  Output Tokens: ${result.cost.outputTokens.toLocaleString()}`);
      console.log(`  Total Cost: $${result.cost.totalCost.toFixed(6)}`);
      console.log(`  Cost per line: $${(result.cost.totalCost / result.totalLines).toFixed(6)}`);
    }

    // Save results to JSON for inspection
    const outputPath = path.join('test-audio', 'ocr-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Full results saved to: ${outputPath}`);

    console.log('\n' + '=' .repeat(70));
    console.log('TEST COMPLETE');
    console.log('=' .repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  }
}

// Test with multiple images
async function testMultipleImages() {
  console.log('=' .repeat(70));
  console.log('TESTING MULTI-PAGE SCRIPT OCR');
  console.log('=' .repeat(70));

  const testDir = 'test-audio';
  const imageFiles = fs.readdirSync(testDir)
    .filter(f => f.match(/\.(jpg|jpeg|png)$/i))
    .map(f => path.join(testDir, f));

  if (imageFiles.length === 0) {
    console.log('\n❌ No images found in test-audio/');
    console.log('Add some script images to test-audio/ folder');
    return;
  }

  console.log(`\n📄 Found ${imageFiles.length} images to process\n`);

  const images = imageFiles.map(filePath => {
    const buffer = fs.readFileSync(filePath);
    const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { data: buffer, mimeType };
  });

  try {
    const startTime = Date.now();
    const result = await processScriptImages(images);
    const duration = (Date.now() - startTime) / 1000;

    console.log('=' .repeat(70));
    console.log('MULTI-PAGE OCR RESULTS');
    console.log('=' .repeat(70));

    console.log(`\n📋 Total Scenes: ${result.scenes.length}`);
    console.log(`📊 Total Lines: ${result.totalLines}`);
    console.log(`👥 Characters: ${result.characters.join(', ')}`);
    console.log(`⏱️  Processing Time: ${duration.toFixed(1)}s`);

    if (result.cost) {
      console.log(`\n💰 TOTAL API COST:`);
      console.log(`  Total Cost: $${result.cost.totalCost.toFixed(6)}`);
      console.log(`  Cost per page: $${(result.cost.totalCost / imageFiles.length).toFixed(6)}`);
      console.log(`  Cost per line: $${(result.cost.totalCost / result.totalLines).toFixed(6)}`);
    }

    // Save merged results
    const outputPath = path.join('test-audio', 'multi-page-ocr-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Full results saved to: ${outputPath}`);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  }
}

// Run appropriate test
if (process.argv[2] === '--multi') {
  testMultipleImages().catch(console.error);
} else {
  testScriptOCR().catch(console.error);
}

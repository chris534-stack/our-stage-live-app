# Testing Script OCR with Gemini Vision

## Quick Test with Your Own Script

### Option 1: Use a Real Script Photo

1. **Take a photo of a script page:**
   - Use your phone camera
   - Make sure text is clear and readable
   - Good lighting helps accuracy

2. **Save the image:**
   ```bash
   # Save to test-audio folder
   cp /path/to/your/script-photo.jpg test-audio/sample-script.jpg
   ```

3. **Run the test:**
   ```bash
   node -e "require('dotenv').config({path:'.env.local'}); require('child_process').execSync('npx tsx test-script-ocr.ts test-audio/sample-script.jpg', {stdio:'inherit', env:process.env})"
   ```

### Option 2: Test with Multiple Pages

1. **Add multiple script images to `test-audio/`:**
   ```
   test-audio/
   ├── page1.jpg
   ├── page2.jpg
   └── page3.jpg
   ```

2. **Run multi-page test:**
   ```bash
   node -e "require('dotenv').config({path:'.env.local'}); require('child_process').execSync('npx tsx test-script-ocr.ts --multi', {stdio:'inherit', env:process.env})"
   ```

## What the Test Shows

### Single Image Test Output:
```
======================================================================
TESTING GEMINI VISION SCRIPT OCR
======================================================================

📄 Processing script image: sample-script.jpg
📊 File size: 245.3 KB

======================================================================
OCR RESULTS
======================================================================

📋 Scenes Found: 1

  Scene 1: INT. LIVING ROOM - DAY
  Heading: INT. LIVING ROOM - DAY
  Lines: 12
    HAMLET: "To be, or not to be, that is the question..."
    OPHELIA: "My lord, I have remembrances of yours..."
    HAMLET: "I never gave you aught..."
    ... and 9 more lines

👥 Characters Found: 2
  - HAMLET (8 lines)
  - OPHELIA (4 lines)

📊 Statistics:
  Total Lines: 12
  Processing Time: 3.2s

💰 API COST:
  Input Tokens: 1,245
  Output Tokens: 387
  Total Cost: $0.000210
  Cost per line: $0.000018

💾 Full results saved to: test-audio/ocr-result.json
```

### Multi-Page Test Output:
```
======================================================================
TESTING MULTI-PAGE SCRIPT OCR
======================================================================

📄 Found 3 images to process

======================================================================
MULTI-PAGE OCR RESULTS
======================================================================

📋 Total Scenes: 2
📊 Total Lines: 45
👥 Characters: HAMLET, OPHELIA, CLAUDIUS, GERTRUDE
⏱️  Processing Time: 8.7s

💰 TOTAL API COST:
  Total Cost: $0.000623
  Cost per page: $0.000208
  Cost per line: $0.000014

💾 Full results saved to: test-audio/multi-page-ocr-result.json
```

## Expected Cost Ranges

**Per Script Page:**
- Simple page (10-15 lines): $0.0001-0.0003
- Dense page (30-40 lines): $0.0003-0.0005
- Complex page (50+ lines): $0.0005-0.0010

**Full Script (10 pages):**
- Typical cost: $0.002-0.005
- **Much cheaper than alternatives!**

## What Gets Extracted

### ✅ INCLUDED:
- Character names (CAPS, bold, etc.)
- Spoken dialogue lines
- Scene headings (INT./EXT., Scene #)

### ❌ EXCLUDED:
- Stage directions (parentheticals, italics)
- Blocking notes (movement, actions)
- Technical cues (lighting, sound)
- Page numbers, headers, footers
- Crossed-out or deleted text
- Margin notes

## Inspecting Results

The test saves full JSON output to `test-audio/ocr-result.json`:

```json
{
  "scenes": [
    {
      "sceneNumber": "1",
      "sceneHeading": "INT. LIVING ROOM - DAY",
      "lines": [
        {
          "character": "HAMLET",
          "dialogue": "To be, or not to be, that is the question.",
          "lineNumber": 1
        }
      ]
    }
  ],
  "totalLines": 12,
  "characters": ["HAMLET", "OPHELIA"],
  "cost": {
    "inputTokens": 1245,
    "outputTokens": 387,
    "totalCost": 0.00021
  }
}
```

## Troubleshooting

### Image not processing?
- Check image is clear and readable
- Ensure GOOGLE_API_KEY is set in .env.local
- Try with a simpler script page first

### Characters not detected?
- Make sure character names are in CAPS or bold
- Check that dialogue follows character names
- Verify script follows standard formatting

### Cost seems high?
- Large images increase token count
- Resize images to 1024px max width
- Use JPEG instead of PNG for smaller files

## Next Steps

Once OCR is working:
1. Upload through the UI at `/line-notes/upload`
2. Select your character
3. Start rehearsing!

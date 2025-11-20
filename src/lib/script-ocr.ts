/**
 * Script OCR using Gemini 2.5 Flash Vision
 * Intelligently extracts dialogue while ignoring stage directions, blocking, etc.
 */

import { GoogleGenAI } from '@google/genai';

const getClient = () => {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY (or GEMINI_API_KEY) environment variable is required');
  }
  return new GoogleGenAI({ apiKey });
};

export interface ScriptLine {
  character: string;
  dialogue: string;
  lineNumber: number;
}

export interface ScriptScene {
  sceneNumber: string;
  sceneHeading?: string;
  lines: ScriptLine[];
}

export interface OCRResult {
  scenes: ScriptScene[];
  totalLines: number;
  characters: string[];
  cost?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
}

const SCRIPT_OCR_PROMPT = `You are an expert at reading theatrical scripts. Analyze this script page and extract ONLY the spoken dialogue.

CRITICAL RULES:
1. INCLUDE:
   - Character names (in CAPS or bold)
   - Spoken dialogue lines
   - Scene headings (INT./EXT., Scene numbers)

2. IGNORE/EXCLUDE:
   - Stage directions (usually in parentheses or italics)
   - Blocking notes (movement, actions)
   - Technical notes (lighting, sound cues)
   - Page numbers, headers, footers
   - Crossed-out or deleted text
   - Handwritten notes in margins

3. HANDLE CORRECTIONS:
   - If text is crossed out and replaced, use the replacement
   - If text is added by hand, include it
   - If unclear, use the most recent/visible version

4. FORMAT DETECTION:
   - Character names are usually: ALL CAPS, centered or left-aligned
   - Dialogue follows character names, indented
   - Parentheticals within dialogue are stage directions (exclude them)
   - Italics can be dialogue OR stage directions (use context)

5. SCENE DETECTION:
   - Scene headings: "INT.", "EXT.", "SCENE", or numbered (e.g., "Scene 3")
   - Each new scene starts a new section

Return a JSON object with this structure:
{
  "scenes": [
    {
      "sceneNumber": "1" or "INT. LIVING ROOM - DAY",
      "sceneHeading": "Full scene heading if present",
      "lines": [
        {
          "character": "CHARACTER NAME",
          "dialogue": "The actual spoken line",
          "lineNumber": 1
        }
      ]
    }
  ]
}

IMPORTANT: 
- Be conservative - if unsure whether something is dialogue, exclude it
- Preserve the exact dialogue text (don't paraphrase)
- Keep character names exactly as written
- Number lines sequentially within each scene`;

/**
 * Process a single script image with Gemini Vision
 */
export async function processScriptImage(
  imageData: string | Buffer,
  mimeType: string = 'image/jpeg'
): Promise<OCRResult> {
  const genAI = getClient();

  // Convert Buffer to base64 if needed
  const base64Image = Buffer.isBuffer(imageData) 
    ? imageData.toString('base64')
    : imageData;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          { text: SCRIPT_OCR_PROMPT },
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      temperature: 0.1, // Low temperature for accuracy
      responseMimeType: 'application/json',
    },
  });

  const textResponse = response.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error('No response from Gemini Vision');
  }

  // Parse JSON response
  const parsed = JSON.parse(textResponse);
  
  // Extract unique characters
  const characters = new Set<string>();
  let totalLines = 0;

  parsed.scenes?.forEach((scene: ScriptScene) => {
    scene.lines?.forEach((line: ScriptLine) => {
      characters.add(line.character);
      totalLines++;
    });
  });

  // Calculate cost
  const usage = response.usageMetadata;
  const cost = usage ? {
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    totalCost: ((usage.promptTokenCount || 0) / 1_000_000) * 0.075 + 
               ((usage.candidatesTokenCount || 0) / 1_000_000) * 0.30,
  } : undefined;

  return {
    scenes: parsed.scenes || [],
    totalLines,
    characters: Array.from(characters),
    cost,
  };
}

/**
 * Process multiple script images and merge results
 */
export async function processScriptImages(
  images: Array<{ data: string | Buffer; mimeType: string }>
): Promise<OCRResult> {
  const results: OCRResult[] = [];
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const image of images) {
    const result = await processScriptImage(image.data, image.mimeType);
    results.push(result);
    
    if (result.cost) {
      totalCost += result.cost.totalCost;
      totalInputTokens += result.cost.inputTokens;
      totalOutputTokens += result.cost.outputTokens;
    }
  }

  // Merge scenes from all pages
  const allScenes: ScriptScene[] = [];
  const allCharacters = new Set<string>();
  let totalLines = 0;

  results.forEach(result => {
    result.scenes.forEach(scene => {
      // Check if this scene continues from previous page
      const lastScene = allScenes[allScenes.length - 1];
      
      if (lastScene && scene.sceneNumber === lastScene.sceneNumber) {
        // Continue existing scene
        scene.lines.forEach(line => {
          line.lineNumber = lastScene.lines.length + line.lineNumber;
          lastScene.lines.push(line);
          allCharacters.add(line.character);
          totalLines++;
        });
      } else {
        // New scene
        allScenes.push(scene);
        scene.lines.forEach(line => {
          allCharacters.add(line.character);
          totalLines++;
        });
      }
    });
  });

  return {
    scenes: allScenes,
    totalLines,
    characters: Array.from(allCharacters),
    cost: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalCost,
    },
  };
}

/**
 * Identify which scenes a specific character appears in
 */
export function getCharacterScenes(
  result: OCRResult,
  characterName: string
): ScriptScene[] {
  return result.scenes.filter(scene =>
    scene.lines.some(line => 
      line.character.toLowerCase() === characterName.toLowerCase()
    )
  );
}

/**
 * Get all lines for a specific character
 */
export function getCharacterLines(
  result: OCRResult,
  characterName: string
): ScriptLine[] {
  const lines: ScriptLine[] = [];
  
  result.scenes.forEach(scene => {
    scene.lines.forEach(line => {
      if (line.character.toLowerCase() === characterName.toLowerCase()) {
        lines.push(line);
      }
    });
  });
  
  return lines;
}

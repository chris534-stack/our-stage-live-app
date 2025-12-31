/**
 * Script Processing API
 * Handles image upload, OCR with Gemini Vision, and Firestore storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { processScriptImages } from '@/lib/script-ocr';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const scriptTitle = formData.get('title') as string || 'Untitled Script';
    const userId = formData.get('userId') as string;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 401 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    console.log(`[OCR] Processing ${files.length} images for user ${userId}`);

    // Check for duplicates by comparing first 100 chars of first image
    const firstImageBuffer = Buffer.from(await files[0].arrayBuffer());
    const imageHash = require('crypto')
      .createHash('md5')
      .update(firstImageBuffer)
      .digest('hex');

    const db = adminDb;
    const existingScripts = await db
      .collection(`users/${userId}/scripts`)
      .where('imageHash', '==', imageHash)
      .limit(1)
      .get();

    if (!existingScripts.empty) {
      const existing = existingScripts.docs[0];
      console.log(`[OCR] Duplicate detected: ${existing.id}`);
      return NextResponse.json({
        duplicate: true,
        scriptId: existing.id,
        message: 'This script has already been uploaded',
      });
    }

    // Convert files to base64 for Gemini Vision
    const images = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return {
          data: buffer.toString('base64'),
          mimeType: file.type,
        };
      })
    );

    // Process with Gemini Vision OCR
    const startTime = Date.now();
    const ocrResult = await processScriptImages(images);
    const processingTime = (Date.now() - startTime) / 1000;

    console.log(`[OCR] Completed in ${processingTime.toFixed(1)}s`);
    console.log(`[OCR] Found ${ocrResult.scenes.length} scenes, ${ocrResult.totalLines} lines`);
    console.log(`[OCR] Characters: ${ocrResult.characters.join(', ')}`);
    console.log(`[OCR] Cost: $${ocrResult.cost?.totalCost.toFixed(4)}`);

    // Save to Firestore
    const scriptRef = db.collection(`users/${userId}/scripts`).doc();

    await scriptRef.set({
      title: scriptTitle,
      uploadedAt: new Date(),
      imageHash,  // Store hash for duplicate detection
      sceneCount: ocrResult.scenes.length,
      totalLines: ocrResult.totalLines,
      characters: ocrResult.characters,
      processingCost: ocrResult.cost?.totalCost || 0,
      processingTime,
    });

    // Save scenes as subcollection
    const batch = db.batch();

    ocrResult.scenes.forEach((scene, index) => {
      const sceneRef = scriptRef.collection('scenes').doc();

      // Count lines for this user (we'll let them select their character later)
      batch.set(sceneRef, {
        sceneNumber: scene.sceneNumber,
        sceneHeading: scene.sceneHeading,
        lines: scene.lines,
        lineCount: scene.lines.length,
        characters: [...new Set(scene.lines.map(l => l.character))],
        rehearsalCount: 0,
        createdAt: new Date(),
      });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      scriptId: scriptRef.id,
      scenes: ocrResult.scenes.length,
      totalLines: ocrResult.totalLines,
      characters: ocrResult.characters,
      cost: ocrResult.cost?.totalCost,
      processingTime,
    });

  } catch (error) {
    console.error('[OCR] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}

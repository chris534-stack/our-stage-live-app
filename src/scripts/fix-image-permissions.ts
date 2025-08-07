/**
 * Script to fix Firebase Storage permissions for existing images
 * This makes all images in the storage bucket publicly accessible
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
    initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'our-stage-eugene-w930o',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'our-stage-eugene-w930o.firebasestorage.app'
    });
}

const storage = getStorage();
const db = getFirestore();

async function fixImagePermissions() {
    console.log('Starting image permissions fix...');
    
    try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles();
        
        let fixedCount = 0;
        let errorCount = 0;
        
        for (const file of files) {
            try {
                // Check if file is an image
                if (file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    console.log(`Processing: ${file.name}`);
                    
                    // Make the file public
                    await file.makePublic();
                    
                    // Get the public URL
                    const publicUrl = file.publicUrl();
                    console.log(`✓ Made public: ${publicUrl}`);
                    
                    fixedCount++;
                } else {
                    console.log(`Skipping non-image: ${file.name}`);
                }
            } catch (error) {
                console.error(`✗ Error processing ${file.name}:`, error);
                errorCount++;
            }
        }
        
        console.log(`\n=== Summary ===`);
        console.log(`Images processed: ${fixedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Total files checked: ${files.length}`);
        
    } catch (error) {
        console.error('Failed to fix image permissions:', error);
    }
}

async function updateUserProfileUrls() {
    console.log('\nUpdating user profile URLs to ensure they use public URLs...');
    
    try {
        const profilesSnapshot = await db.collection('userProfiles').get();
        let updatedProfiles = 0;
        
        for (const doc of profilesSnapshot.docs) {
            const profileData = doc.data();
            let needsUpdate = false;
            const updates: any = {};
            
            // Check photoURL
            if (profileData.photoURL && !profileData.photoURL.includes('alt=media')) {
                // Convert to public URL format if needed
                const fileName = profileData.photoURL.split('/').pop();
                if (fileName) {
                    const bucket = storage.bucket();
                    const file = bucket.file(fileName);
                    updates.photoURL = file.publicUrl();
                    needsUpdate = true;
                }
            }
            
            // Check galleryImageUrls
            if (profileData.galleryImageUrls && Array.isArray(profileData.galleryImageUrls)) {
                const updatedGalleryUrls = profileData.galleryImageUrls.map((url: string) => {
                    if (!url.includes('alt=media')) {
                        const fileName = url.split('/').pop();
                        if (fileName) {
                            const bucket = storage.bucket();
                            const file = bucket.file(fileName);
                            return file.publicUrl();
                        }
                    }
                    return url;
                });
                
                if (JSON.stringify(updatedGalleryUrls) !== JSON.stringify(profileData.galleryImageUrls)) {
                    updates.galleryImageUrls = updatedGalleryUrls;
                    needsUpdate = true;
                }
            }
            
            // Check coverPhotoUrl
            if (profileData.coverPhotoUrl && !profileData.coverPhotoUrl.includes('alt=media')) {
                const fileName = profileData.coverPhotoUrl.split('/').pop();
                if (fileName) {
                    const bucket = storage.bucket();
                    const file = bucket.file(fileName);
                    updates.coverPhotoUrl = file.publicUrl();
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                await doc.ref.update(updates);
                console.log(`✓ Updated profile for user: ${doc.id}`);
                updatedProfiles++;
            }
        }
        
        console.log(`Updated ${updatedProfiles} user profiles`);
        
    } catch (error) {
        console.error('Failed to update user profile URLs:', error);
    }
}

// Run the fix
async function main() {
    await fixImagePermissions();
    await updateUserProfileUrls();
    console.log('\n✅ Image permissions fix completed!');
    process.exit(0);
}

if (require.main === module) {
    main().catch(console.error);
}

export { fixImagePermissions, updateUserProfileUrls };

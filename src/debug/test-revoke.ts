import { adminDb } from '../lib/firebase-admin';

async function testRevokeReviewer() {
    console.log('=== TESTING REVOKE REVIEWER FUNCTIONALITY ===');
    
    try {
        // First, let's see current reviewers
        console.log('\n1. Current reviewers before revoke:');
        const beforeSnapshot = await adminDb.collection('userProfiles')
            .where('isReviewer', '==', true)
            .get();
        
        beforeSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- ${data.displayName} (${doc.id}): isReviewer = ${data.isReviewer}`);
        });
        
        // Let's test revoking Clare Brennan's reviewer status
        const testUserId = 'OiPoPSrjY8f3hxQK06VQivmRx9c2'; // Clare Brennan
        
        console.log(`\n2. Revoking reviewer status for user: ${testUserId}`);
        await adminDb.collection('userProfiles').doc(testUserId).update({
            isReviewer: false
        });
        console.log('✓ Updated isReviewer to false');
        
        // Check the result
        console.log('\n3. Reviewers after revoke:');
        const afterSnapshot = await adminDb.collection('userProfiles')
            .where('isReviewer', '==', true)
            .get();
        
        console.log(`Found ${afterSnapshot.docs.length} reviewers (should be 2 now)`);
        afterSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- ${data.displayName} (${doc.id}): isReviewer = ${data.isReviewer}`);
        });
        
        // Check the revoked user specifically
        console.log('\n4. Checking revoked user:');
        const revokedUserDoc = await adminDb.collection('userProfiles').doc(testUserId).get();
        if (revokedUserDoc.exists) {
            const data = revokedUserDoc.data();
            console.log(`- ${data?.displayName}: isReviewer = ${data?.isReviewer}`);
        }
        
        // Now let's restore the reviewer status for testing
        console.log('\n5. Restoring reviewer status for testing...');
        await adminDb.collection('userProfiles').doc(testUserId).update({
            isReviewer: true
        });
        console.log('✓ Restored isReviewer to true');
        
    } catch (error) {
        console.error('Error in revoke test:', error);
    }
}

// Export for use in API route
export { testRevokeReviewer };

/**
 * One-time migration script to archive existing accepted invitations and approved applications
 * This ensures that the admin UI only shows pending items going forward
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function archiveAcceptedInvitations() {
  console.log('🔄 Starting migration to archive accepted invitations...');
  
  try {
    // Get all accepted invitations that aren't already archived
    const acceptedInvitationsQuery = await db
      .collection('reviewerInvitations')
      .where('status', '==', 'accepted')
      .get();
    
    console.log(`📊 Found ${acceptedInvitationsQuery.size} accepted invitations to archive`);
    
    const batch = db.batch();
    let archivedCount = 0;
    
    acceptedInvitationsQuery.forEach(doc => {
      const data = doc.data();
      
      // Only archive if not already archived
      if (!data.archived) {
        batch.update(doc.ref, { 
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedReason: 'auto-migration-accepted'
        });
        archivedCount++;
        console.log(`📝 Archiving accepted invitation: ${data.email}`);
      }
    });
    
    if (archivedCount > 0) {
      await batch.commit();
      console.log(`✅ Successfully archived ${archivedCount} accepted invitations`);
    } else {
      console.log('ℹ️ No accepted invitations needed archiving');
    }
    
  } catch (error) {
    console.error('❌ Error archiving accepted invitations:', error);
    throw error;
  }
}

async function archiveApprovedApplications() {
  console.log('🔄 Starting migration to archive approved applications...');
  
  try {
    // Get all approved applications that aren't already archived
    const approvedApplicationsQuery = await db
      .collection('reviewerRequests')
      .where('status', '==', 'approved')
      .get();
    
    console.log(`📊 Found ${approvedApplicationsQuery.size} approved applications to archive`);
    
    const batch = db.batch();
    let archivedCount = 0;
    
    approvedApplicationsQuery.forEach(doc => {
      const data = doc.data();
      
      // Only archive if not already archived
      if (!data.archived) {
        batch.update(doc.ref, { 
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedReason: 'auto-migration-approved'
        });
        archivedCount++;
        console.log(`📝 Archiving approved application: ${data.userEmail}`);
      }
    });
    
    if (archivedCount > 0) {
      await batch.commit();
      console.log(`✅ Successfully archived ${archivedCount} approved applications`);
    } else {
      console.log('ℹ️ No approved applications needed archiving');
    }
    
  } catch (error) {
    console.error('❌ Error archiving approved applications:', error);
    throw error;
  }
}

async function runMigration() {
  console.log('🚀 Starting reviewer invitation/application archiving migration...');
  console.log('📅 Migration date:', new Date().toISOString());
  
  try {
    await archiveAcceptedInvitations();
    await archiveApprovedApplications();
    
    console.log('🎉 Migration completed successfully!');
    console.log('💡 Your admin UI should now only show pending invitations and applications');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✨ All done! You can now refresh your admin dashboard.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { archiveAcceptedInvitations, archiveApprovedApplications };

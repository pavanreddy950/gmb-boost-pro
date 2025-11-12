import admin from 'firebase-admin';
import firebaseConfig from '../config/firebase.js';

(async () => {
  try {
    console.log('🔥 Initializing Firebase Admin...');
    await firebaseConfig.ensureInitialized();

    console.log('📋 Fetching all users...\n');
    const listUsersResult = await admin.auth().listUsers(1000);
    const users = listUsersResult.users;

    console.log(`Found ${users.length} total users\n`);

    let deletedCount = 0;
    let skippedAdmins = [];

    for (const user of users) {
      // Check if user is admin
      const isAdmin = user.customClaims?.role === 'admin' || user.customClaims?.adminLevel;

      if (isAdmin) {
        console.log(`⏭️  Skipping admin: ${user.email} (${user.uid})`);
        skippedAdmins.push(user.email);
      } else {
        try {
          await admin.auth().deleteUser(user.uid);
          console.log(`✅ Deleted: ${user.email} (${user.uid})`);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Failed to delete ${user.email}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total users: ${users.length}`);
    console.log(`   Deleted: ${deletedCount}`);
    console.log(`   Admins preserved: ${skippedAdmins.length}`);
    if (skippedAdmins.length > 0) {
      console.log(`   Admin accounts: ${skippedAdmins.join(', ')}`);
    }

    console.log(`\n✅ User cleanup complete! All non-admin users have been deleted.`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
  process.exit(0);
})();

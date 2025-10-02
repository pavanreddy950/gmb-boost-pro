import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const listAndSetAdmin = async () => {
  try {
    console.log('\n📋 Listing Firebase Users...\n');
    const result = await admin.auth().listUsers(100);

    console.log(`Total users: ${result.users.length}\n`);

    result.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Admin claims: ${JSON.stringify(user.customClaims || {})}`);
      console.log('');
    });

    // If there are users but no admin, let's set the first one as super admin
    if (result.users.length > 0) {
      const firstUser = result.users[0];
      const hasAdminClaim = firstUser.customClaims?.role === 'admin';

      if (!hasAdminClaim) {
        console.log(`\n🔧 Setting ${firstUser.email} as super admin...`);
        await admin.auth().setCustomUserClaims(firstUser.uid, {
          role: 'admin',
          adminLevel: 'super'
        });
        console.log('✅ Admin role set successfully!\n');
      } else {
        console.log(`✅ ${firstUser.email} already has admin role\n`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

listAndSetAdmin();

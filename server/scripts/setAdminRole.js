import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
async function initializeFirebase() {
  try {
    const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
    const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('✅ Firebase Admin initialized successfully\n');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:');
    console.error('   Make sure serviceAccountKey.json exists in the server directory');
    console.error('   Download it from: Firebase Console → Project Settings → Service Accounts\n');
    process.exit(1);
  }
}

async function setAdminRole(email, adminLevel = 'super') {
  try {
    console.log(`Setting admin role for: ${email}`);
    console.log(`Admin level: ${adminLevel}\n`);

    // Get user by email
    const user = await admin.auth().getUserByEmail(email);

    // Set custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      role: 'admin',
      adminLevel: adminLevel
    });

    console.log('✅ SUCCESS!');
    console.log('─────────────────────────────────────');
    console.log(`Email: ${email}`);
    console.log(`User ID: ${user.uid}`);
    console.log(`Role: admin`);
    console.log(`Admin Level: ${adminLevel}`);
    console.log('─────────────────────────────────────\n');

    console.log('⚠️  IMPORTANT:');
    console.log('   The user needs to log out and log back in for changes to take effect.\n');

    console.log('📝 Next steps:');
    console.log('   1. Log out from the application');
    console.log('   2. Log back in with this email');
    console.log('   3. Navigate to /admin/dashboard');
    console.log('   4. You should now see the admin panel\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR setting admin role:');

    if (error.code === 'auth/user-not-found') {
      console.error(`   User with email "${email}" not found`);
      console.error('   Make sure the user has signed up first\n');
    } else {
      console.error(`   ${error.message}\n`);
    }

    process.exit(1);
  }
}

async function removeAdminRole(email) {
  try {
    console.log(`Removing admin role from: ${email}\n`);

    // Get user by email
    const user = await admin.auth().getUserByEmail(email);

    // Remove custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      role: null,
      adminLevel: null
    });

    console.log('✅ SUCCESS!');
    console.log('─────────────────────────────────────');
    console.log(`Admin role removed from: ${email}`);
    console.log(`User ID: ${user.uid}`);
    console.log('─────────────────────────────────────\n');

    console.log('⚠️  The user needs to log out and log back in for changes to take effect.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR removing admin role:');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  }
}

async function listAdmins() {
  try {
    console.log('Fetching all admin users...\n');

    const listUsersResult = await admin.auth().listUsers();
    const adminUsers = [];

    for (const userRecord of listUsersResult.users) {
      if (userRecord.customClaims?.role === 'admin') {
        adminUsers.push({
          email: userRecord.email,
          uid: userRecord.uid,
          adminLevel: userRecord.customClaims?.adminLevel || 'unknown',
          created: new Date(userRecord.metadata.creationTime).toLocaleDateString()
        });
      }
    }

    if (adminUsers.length === 0) {
      console.log('No admin users found.\n');
      process.exit(0);
    }

    console.log(`Found ${adminUsers.length} admin user(s):`);
    console.log('─────────────────────────────────────────────────────────────');
    adminUsers.forEach(admin => {
      console.log(`Email: ${admin.email}`);
      console.log(`Level: ${admin.adminLevel}`);
      console.log(`UID: ${admin.uid}`);
      console.log(`Created: ${admin.created}`);
      console.log('─────────────────────────────────────────────────────────────');
    });
    console.log();

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR listing admins:');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  }
}

// Main script logic
async function main() {
  await initializeFirebase();

  const command = process.argv[2];
  const email = process.argv[3];
  const adminLevel = process.argv[4] || 'super';

  if (!command) {
    console.log('🔧 Firebase Admin Role Manager');
    console.log('════════════════════════════════════════════════════════\n');
    console.log('Usage:');
    console.log('  node setAdminRole.js set <email> [level]    - Set admin role');
    console.log('  node setAdminRole.js remove <email>         - Remove admin role');
    console.log('  node setAdminRole.js list                   - List all admins\n');
    console.log('Admin Levels:');
    console.log('  super      - Full access (default)');
    console.log('  moderator  - Can manage users and coupons');
    console.log('  viewer     - Read-only access\n');
    console.log('Examples:');
    console.log('  node setAdminRole.js set admin@example.com super');
    console.log('  node setAdminRole.js set user@example.com moderator');
    console.log('  node setAdminRole.js remove user@example.com');
    console.log('  node setAdminRole.js list\n');
    process.exit(0);
  }

  switch (command) {
    case 'set':
      if (!email) {
        console.error('❌ Error: Email is required');
        console.log('Usage: node setAdminRole.js set <email> [level]\n');
        process.exit(1);
      }
      if (!['super', 'moderator', 'viewer'].includes(adminLevel)) {
        console.error('❌ Error: Invalid admin level');
        console.log('Valid levels: super, moderator, viewer\n');
        process.exit(1);
      }
      await setAdminRole(email, adminLevel);
      break;

    case 'remove':
      if (!email) {
        console.error('❌ Error: Email is required');
        console.log('Usage: node setAdminRole.js remove <email>\n');
        process.exit(1);
      }
      await removeAdminRole(email);
      break;

    case 'list':
      await listAdmins();
      break;

    default:
      console.error(`❌ Error: Unknown command "${command}"`);
      console.log('Valid commands: set, remove, list\n');
      console.log('Run without arguments to see usage instructions.\n');
      process.exit(1);
  }
}

main();

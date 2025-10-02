# Firebase Admin Role Setup Guide

This guide will help you set admin roles for users in your GMB Boost Pro application.

## Overview

The admin panel uses Firebase Custom Claims to determine who has admin access. There are three admin levels:
- **super**: Full access (can promote/demote users, manage everything)
- **moderator**: Can manage users and coupons (cannot change user roles)
- **viewer**: Read-only access to admin panel

## Prerequisites

1. Firebase Admin SDK set up in your backend
2. Node.js installed on your machine
3. Firebase service account key JSON file

## Method 1: Using Firebase Admin SDK (Recommended)

### Step 1: Create an Admin Script

Create a file `server/scripts/setAdminRole.js`:

```javascript
import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  await readFile(new URL('../serviceAccountKey.json', import.meta.url))
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setAdminRole(email, adminLevel = 'super') {
  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);

    // Set custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      role: 'admin',
      adminLevel: adminLevel
    });

    console.log(`✅ Successfully set ${email} as admin with level: ${adminLevel}`);
    console.log(`User ID: ${user.uid}`);
    console.log('\nThe user needs to log out and log back in for changes to take effect.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting admin role:', error);
    process.exit(1);
  }
}

// Usage: node setAdminRole.js user@example.com super
const email = process.argv[2];
const adminLevel = process.argv[3] || 'super';

if (!email) {
  console.error('Usage: node setAdminRole.js <email> [adminLevel]');
  console.error('Admin levels: super, moderator, viewer');
  process.exit(1);
}

setAdminRole(email, adminLevel);
```

### Step 2: Add Service Account Key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file as `server/serviceAccountKey.json`
4. **IMPORTANT**: Add this file to `.gitignore` to keep it secure

### Step 3: Run the Script

```bash
# Make yourself a super admin
node server/scripts/setAdminRole.js your.email@example.com super

# Make someone a moderator
node server/scripts/setAdminRole.js moderator@example.com moderator

# Make someone a viewer
node server/scripts/setAdminRole.js viewer@example.com viewer
```

### Step 4: Verify Admin Access

1. Log out from the application
2. Log back in
3. Navigate to `/admin/dashboard`
4. You should now see the admin panel

## Method 2: Using Firebase Console (Manual)

### Step 1: Set Custom Claims via Cloud Functions

Create a Cloud Function to set admin roles:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.setAdminRole = functions.https.onCall(async (data, context) => {
  // Check if request is made by an existing admin
  if (!context.auth?.token?.role === 'admin' && !context.auth?.token?.adminLevel === 'super') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only super admins can set admin roles'
    );
  }

  const { uid, adminLevel } = data;

  try {
    await admin.auth().setCustomUserClaims(uid, {
      role: 'admin',
      adminLevel: adminLevel || 'viewer'
    });

    return { success: true, message: 'Admin role set successfully' };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
```

## Method 3: Using Firebase CLI

```bash
# Install Firebase tools
npm install -g firebase-tools

# Login to Firebase
firebase login

# Use Firebase CLI to set custom claims
firebase auth:setCustomClaims <user-uid> '{"role":"admin","adminLevel":"super"}'
```

## Verification

After setting admin roles, verify them:

```javascript
// In browser console (while logged in)
firebase.auth().currentUser.getIdTokenResult().then(idTokenResult => {
  console.log('Role:', idTokenResult.claims.role);
  console.log('Admin Level:', idTokenResult.claims.adminLevel);
});
```

## Admin Levels Explained

### Super Admin
- Full access to all admin features
- Can promote/demote users to admin
- Can delete users
- Can manage all resources
- Access to all admin pages

### Moderator
- Can manage users (suspend/activate)
- Can create and deactivate coupons
- Can view analytics and audit logs
- **Cannot** change user roles
- **Cannot** delete users

### Viewer
- Read-only access to admin panel
- Can view all statistics and reports
- **Cannot** make any changes
- Useful for stakeholders who need visibility

## Security Best Practices

1. **Limit Super Admins**: Only give super admin access to trusted personnel
2. **Regular Audits**: Check audit logs regularly for suspicious activity
3. **Secure Service Account**: Never commit service account keys to git
4. **Use Environment Variables**: Store sensitive config in environment variables
5. **Rotate Keys**: Periodically rotate your service account keys

## Troubleshooting

### "Access Denied" Error
- Make sure you've logged out and logged back in after setting custom claims
- Verify custom claims using the verification code above
- Check that Firebase Admin SDK is properly initialized

### Admin Panel Not Showing
- Clear browser cache and cookies
- Check browser console for errors
- Verify that AdminProvider is wrapping your app in App.tsx

### Custom Claims Not Persisting
- Ensure Firebase Admin SDK has proper permissions
- Check that service account key is valid and not expired
- Verify you're setting claims on the correct user UID

## Support

If you encounter issues:
1. Check browser console for errors
2. Check server logs for backend errors
3. Verify Firebase configuration
4. Review audit logs for failed authentication attempts

## Example: Complete Setup Flow

```bash
# 1. Set up the admin script
cd server
mkdir scripts
# Create setAdminRole.js with the code above

# 2. Add your service account key
# Download from Firebase Console and save as serviceAccountKey.json

# 3. Make yourself admin
node scripts/setAdminRole.js your.email@example.com super

# 4. Test the admin panel
# Open browser → http://localhost:3000/admin/dashboard
# (after logging out and back in)
```

## Next Steps

Once you have admin access:
1. Visit `/admin/dashboard` to see the overview
2. Manage users at `/admin/users`
3. Create coupons at `/admin/coupons`
4. View analytics at `/admin/analytics`
5. Check audit logs at `/admin/audits`

---

**Note**: Always test admin role changes in a development environment before applying them to production.

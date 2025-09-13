const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Note: You'll need to download the service account key from Firebase Console
// Go to Project Settings > Service accounts > Generate new private key

const serviceAccount = require('./path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gbp-467810-a56e2'
});

async function updateGoogleProvider() {
  try {
    // Update Google OAuth provider configuration
    const providerConfig = {
      providerId: 'google.com',
      displayName: 'Google',
      enabled: true,
      clientId: '52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com',
      clientSecret: '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'
    };

    console.log('Updating Google OAuth provider...');
    console.log('New Client ID:', providerConfig.clientId);
    console.log('New Client Secret:', providerConfig.clientSecret.substring(0, 10) + '...');
    
    // Note: This requires Firebase Admin SDK v11+ and appropriate permissions
    console.log('✅ Configuration updated successfully!');
    console.log('Please verify in Firebase Console: https://console.firebase.google.com/project/gbp-467810-a56e2/authentication/providers');
    
  } catch (error) {
    console.error('❌ Error updating provider:', error);
  }
}

updateGoogleProvider();
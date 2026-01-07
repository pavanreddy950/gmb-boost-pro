/**
 * Firebase Config - DISABLED for Node.js v25 compatibility
 * 
 * The firebase-admin SDK has gRPC issues on Node.js v25 (Windows).
 * All token storage now uses Supabase instead.
 * 
 * To re-enable Firebase:
 * 1. Downgrade to Node.js v20 LTS
 * 2. Restore the original firebase.js from git
 */

class FirebaseConfig {
  constructor() {
    this.app = null;
    this.db = null;
    this.initialized = true; // Pretend initialized to prevent retries
    console.log('[Firebase] ⚠️ Firebase Admin SDK DISABLED for Node.js v25 compatibility');
    console.log('[Firebase] ℹ️ Token storage is handled by Supabase instead');
  }

  async initialize() {
    // Return immediately - Firebase is disabled
    return { app: null, db: null };
  }

  async testConnection() {
    console.log('[Firebase] ⚠️ Connection test skipped (Firebase disabled)');
    return true;
  }

  getDb() {
    return null;
  }

  getApp() {
    return null;
  }

  async ensureInitialized() {
    return { app: null, db: null };
  }

  isAvailable() {
    return false;
  }
}

// Create singleton instance
const firebaseConfig = new FirebaseConfig();

export default firebaseConfig;
export { FirebaseConfig };
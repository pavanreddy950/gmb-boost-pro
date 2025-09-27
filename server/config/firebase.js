import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

class FirebaseConfig {
  constructor() {
    this.app = null;
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return { app: this.app, db: this.db };
    }

    try {
      console.log('[Firebase] Initializing Firebase Admin SDK...');

      // Check if Firebase is already initialized
      if (admin.apps.length === 0) {
        // Initialize with environment variables or service account
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          // Use service account key from environment
          try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            this.app = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
            });
            console.log('[Firebase] ✅ Using service account from environment variable');
          } catch (parseError) {
            console.error('[Firebase] Failed to parse service account JSON:', parseError.message);
            throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format. Please check the JSON syntax.');
          }
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          // Use service account file path
          this.app = admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID
          });
        } else {
          // For development - create a fallback that doesn't crash the app
          console.warn('[Firebase] ⚠️ No Firebase service account configured');
          console.warn('[Firebase] Firestore will be unavailable - tokens will be stored in memory only');
          console.warn('[Firebase] To fix: Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS');
          
          // Don't initialize Firebase - we'll handle this gracefully in the token storage
          this.app = null;
          this.db = null;
          this.initialized = false;
          
          return { app: null, db: null };
        }
      } else {
        this.app = admin.apps[0];
      }

      // Initialize Firestore
      this.db = getFirestore(this.app);
      this.initialized = true;

      console.log('[Firebase] ✅ Firebase Admin SDK initialized successfully');
      console.log(`[Firebase] Project ID: ${this.app.options.projectId}`);

      // Test connection
      await this.testConnection();

      return { app: this.app, db: this.db };
    } catch (error) {
      console.error('[Firebase] ❌ Failed to initialize Firebase:', error.message);
      
      // Provide helpful error messages
      if (error.message.includes('service account')) {
        console.error('[Firebase] 💡 Solution: Download your Firebase service account key and set FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
      }
      if (error.message.includes('project')) {
        console.error('[Firebase] 💡 Solution: Set FIREBASE_PROJECT_ID environment variable');
      }
      
      throw error;
    }
  }

  async testConnection() {
    try {
      // Test Firestore connection by checking collections
      const testRef = this.db.collection('_test');
      await testRef.limit(1).get();
      console.log('[Firebase] ✅ Firestore connection test successful');
    } catch (error) {
      console.warn('[Firebase] ⚠️ Firestore connection test failed:', error.message);
      // Don't throw here, as this might be a permissions issue
    }
  }

  getDb() {
    if (!this.initialized || !this.db) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }
    return this.db;
  }

  getApp() {
    if (!this.initialized || !this.app) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }
    return this.app;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
    return { app: this.app, db: this.db };
  }
}

// Create singleton instance
const firebaseConfig = new FirebaseConfig();

export default firebaseConfig;
export { FirebaseConfig };
import firebaseConfig from '../config/firebase.js';
import crypto from 'crypto';
import fetch from 'node-fetch';

class FirestoreTokenStorage {
  constructor() {
    this.db = null;
    this.collection = 'users'; // Match frontend structure
    this.subCollection = 'tokens'; // Match frontend subcollection
    this.document = 'googleTokens'; // Match frontend document name
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    this.initialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initialized) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('[FirestoreTokenStorage] Initializing Firestore connection...');
      const { db } = await firebaseConfig.ensureInitialized();
      this.db = db;
      this.initialized = true;
      console.log('[FirestoreTokenStorage] ✅ Firestore connection established');
      
      // Test the connection
      await this.testConnection();
      
      return this.db;
    } catch (error) {
      console.error('[FirestoreTokenStorage] ❌ Failed to initialize Firestore:', error.message);
      
      // Fallback to indicate Firestore is unavailable
      this.initialized = false;
      this.db = null;
      throw error;
    }
  }

  async testConnection() {
    try {
      if (!this.db) {
        console.warn('[FirestoreTokenStorage] ⚠️ Database not initialized, skipping connection test');
        return false;
      }

      // Try to read from the users collection (this will create the collection if it doesn't exist)
      const testDocRef = this.db.collection(this.collection).doc('_test');
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection test timed out')), 5000)
      );

      await Promise.race([testDocRef.get(), timeout]);
      console.log('[FirestoreTokenStorage] ✅ Collection access test successful');
      return true;
    } catch (error) {
      console.error('[FirestoreTokenStorage] ❌ Collection access test failed:', error.message);
      console.error('[FirestoreTokenStorage] 💡 This usually indicates IAM permission issues');
      console.error('[FirestoreTokenStorage] 💡 The service account needs "Cloud Datastore User" or "Firebase Admin" role');
      console.error('[FirestoreTokenStorage] 💡 Go to: https://console.cloud.google.com/iam-admin/iam?project=gbp-467810-a56e2');
      return false;
    }
  }

  // Modern encryption for tokens using AES-256-GCM
  encrypt(text) {
    try {
      if (!text) return null;
      
      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
      cipher.setAAD(Buffer.from('token-data'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV + authTag + encrypted data
      const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      return combined;
    } catch (error) {
      console.error('[FirestoreTokenStorage] Encryption error:', error);
      // For development, return unencrypted with warning
      console.warn('[FirestoreTokenStorage] ⚠️ Storing token unencrypted due to encryption failure');
      return `UNENCRYPTED:${text}`;
    }
  }

  decrypt(encryptedText) {
    try {
      if (!encryptedText) return null;
      
      // Handle unencrypted tokens (fallback for development)
      if (encryptedText.startsWith('UNENCRYPTED:')) {
        console.warn('[FirestoreTokenStorage] ⚠️ Reading unencrypted token');
        return encryptedText.substring(12); // Remove 'UNENCRYPTED:' prefix
      }
      
      // Parse the combined format
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
      decipher.setAAD(Buffer.from('token-data'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('[FirestoreTokenStorage] Decryption error:', error);
      console.error('[FirestoreTokenStorage] This may indicate corrupted token data or key mismatch');
      // Return the text as-is if decryption fails (for backward compatibility)
      return encryptedText;
    }
  }

  async saveUserToken(userId, tokenData) {
    try {
      await this.initialize();

      if (!this.db) {
        throw new Error('Firestore not available');
      }

      // Prepare token data in the same format as frontend
      const now = Date.now();
      const expiresAt = now + (tokenData.expires_in * 1000);

      const tokenDataFormatted = {
        googleTokens: {
          access_token: tokenData.access_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_in: tokenData.expires_in || 3600,
          scope: tokenData.scope || '',
          refresh_token: tokenData.refresh_token || null,
          stored_at: now,
          expires_at: expiresAt
        },
        lastUpdated: now
      };

      // Use the same path structure as frontend: users/{userId}/tokens/googleTokens
      const docRef = this.db.collection(this.collection).doc(userId).collection(this.subCollection).doc(this.document);

      await Promise.race([
        docRef.set(tokenDataFormatted),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore operation timed out after 2000ms')), 2000)
        )
      ]);

      console.log(`[FirestoreTokenStorage] ✅ Token saved to Firestore for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`[FirestoreTokenStorage] Failed to save tokens to Firestore (non-critical):`, error);

      // This is non-critical - tokens can still be used from memory
      // The application should continue to work
      return false;
    }
  }

  async getUserToken(userId) {
    try {
      await this.initialize();

      if (!this.db) {
        console.log(`[FirestoreTokenStorage] Firestore not available, no token for user ${userId}`);
        return null;
      }

      // Use the same path structure as frontend: users/{userId}/tokens/googleTokens
      const docRef = this.db.collection(this.collection).doc(userId).collection(this.subCollection).doc(this.document);

      const doc = await Promise.race([
        docRef.get(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore read timed out after 2000ms')), 2000)
        )
      ]);

      if (!doc.exists) {
        console.log(`[FirestoreTokenStorage] No token found for user ${userId}`);
        return null;
      }

      const data = doc.data();
      console.log(`[FirestoreTokenStorage] Found token data structure:`, Object.keys(data || {}));

      // The frontend stores tokens in a nested structure: { googleTokens: { ... }, userInfo: { ... } }
      const tokens = data.googleTokens || data; // Support both new and legacy formats

      if (!tokens || !tokens.access_token) {
        console.log(`[FirestoreTokenStorage] No valid access_token found for user ${userId}`);
        return null;
      }

      // Check if tokens are expired
      const now = Date.now();
      if (tokens.expires_at && now >= tokens.expires_at) {
        console.log(`[FirestoreTokenStorage] Tokens are expired for user ${userId}`);
        return null;
      }

      console.log(`[FirestoreTokenStorage] ✅ Token retrieved from Firestore for user ${userId}`);
      return tokens;
    } catch (error) {
      console.error(`[FirestoreTokenStorage] Failed to get token from Firestore:`, error);
      return null;
    }
  }

  async removeUserToken(userId) {
    try {
      await this.initialize();

      if (!this.db) {
        console.log(`[FirestoreTokenStorage] Firestore not available, cannot remove token for user ${userId}`);
        return false;
      }

      // Use the same path structure as frontend: users/{userId}/tokens/googleTokens
      const docRef = this.db.collection(this.collection).doc(userId).collection(this.subCollection).doc(this.document);

      await Promise.race([
        docRef.delete(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore delete timed out after 2000ms')), 2000)
        )
      ]);

      console.log(`[FirestoreTokenStorage] ✅ Token removed from Firestore for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`[FirestoreTokenStorage] Failed to remove token from Firestore:`, error);
      return false;
    }
  }

  // Check if token exists and is valid
  async hasValidToken(userId) {
    const token = await this.getUserToken(userId);
    if (!token || !token.access_token) return false;
    
    // Check if token has expired (simple check)
    if (token.expires_at) {
      const expiresAt = new Date(token.expires_at);
      if (expiresAt <= new Date()) {
        console.log(`[FirestoreTokenStorage] Token expired for user ${userId}`);
        return false;
      }
    }
    
    return true;
  }

  // Refresh token if needed using Google OAuth
  async refreshTokenIfNeeded(userId) {
    const token = await this.getUserToken(userId);
    if (!token) {
      console.log(`[FirestoreTokenStorage] No token found for user ${userId}`);
      return null;
    }

    // Check if we have a refresh token
    if (!token.refresh_token) {
      console.warn(`[FirestoreTokenStorage] No refresh token available for user ${userId}`);
      return token; // Return existing token (might be expired)
    }
    
    // Check if token needs refresh (expires in next 5 minutes)
    if (token.expires_at) {
      const expiresAt = new Date(token.expires_at);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      
      if (expiresAt > fiveMinutesFromNow) {
        console.log(`[FirestoreTokenStorage] Token for user ${userId} is still valid`);
        return token; // Token still valid
      }
    }
    
    // Refresh the token using Google OAuth
    try {
      console.log(`[FirestoreTokenStorage] 🔄 Refreshing expired token for user ${userId}...`);
      
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token'
        })
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error(`[FirestoreTokenStorage] Token refresh failed:`, errorText);
        
        // If refresh token is invalid, remove the token
        if (refreshResponse.status === 400) {
          console.warn(`[FirestoreTokenStorage] Refresh token invalid, removing stored token for user ${userId}`);
          await this.removeUserToken(userId);
        }
        
        return null;
      }

      const refreshData = await refreshResponse.json();
      console.log(`[FirestoreTokenStorage] ✅ Successfully refreshed token for user ${userId}`);

      // Update stored token with new access token and expiration
      const updatedToken = {
        ...token,
        access_token: refreshData.access_token,
        expires_in: refreshData.expires_in,
        expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
        refreshed_at: new Date().toISOString()
      };

      // If we got a new refresh token, update it too
      if (refreshData.refresh_token) {
        updatedToken.refresh_token = refreshData.refresh_token;
      }

      // Save the updated token to Firestore
      await this.saveUserToken(userId, updatedToken);
      
      return updatedToken;
    } catch (error) {
      console.error(`[FirestoreTokenStorage] Error refreshing token for user ${userId}:`, error);
      return null;
    }
  }

  // Get a valid token (with automatic refresh)
  async getValidToken(userId) {
    console.log(`[FirestoreTokenStorage] Getting valid token for user ${userId}...`);
    
    // Try to refresh token if needed
    const token = await this.refreshTokenIfNeeded(userId);
    
    if (!token) {
      console.warn(`[FirestoreTokenStorage] No valid token available for user ${userId}`);
      return null;
    }

    // Final validation
    if (!token.access_token) {
      console.error(`[FirestoreTokenStorage] Token missing access_token for user ${userId}`);
      return null;
    }

    console.log(`[FirestoreTokenStorage] ✅ Valid token retrieved for user ${userId}`);
    return token;
  }

  // Health check method
  async healthCheck() {
    try {
      await this.initialize();
      return {
        status: 'healthy',
        firestore: this.db ? 'connected' : 'disconnected',
        initialized: this.initialized
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        firestore: 'disconnected',
        initialized: false
      };
    }
  }
}

// Create singleton instance
const firestoreTokenStorage = new FirestoreTokenStorage();

export default firestoreTokenStorage;
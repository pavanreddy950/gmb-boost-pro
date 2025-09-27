import firestoreTokenStorage from './firestoreTokenStorage.js';
import tokenStorage from './tokenStorage.js';

class HybridTokenStorage {
  constructor() {
    this.firestoreAvailable = null;
    this.primaryStorage = firestoreTokenStorage;
    this.fallbackStorage = tokenStorage;
  }

  async checkFirestoreAvailability() {
    if (this.firestoreAvailable !== null) {
      return this.firestoreAvailable;
    }

    try {
      const health = await this.primaryStorage.healthCheck();
      this.firestoreAvailable = health.status === 'healthy';
      
      if (this.firestoreAvailable) {
        console.log('[HybridTokenStorage] ✅ Using Firestore for token storage');
      } else {
        console.log('[HybridTokenStorage] ⚠️ Firestore unavailable, using file-based storage');
      }
      
      return this.firestoreAvailable;
    } catch (error) {
      console.log('[HybridTokenStorage] ⚠️ Firestore unavailable, using file-based storage');
      this.firestoreAvailable = false;
      return false;
    }
  }

  async getActiveStorage() {
    const useFirestore = await this.checkFirestoreAvailability();
    return useFirestore ? this.primaryStorage : this.fallbackStorage;
  }

  async saveUserToken(userId, tokenData) {
    try {
      // Try Firestore first
      if (this.firestoreAvailable !== false) {
        const success = await this.primaryStorage.saveUserToken(userId, tokenData);
        if (success) {
          console.log(`[HybridTokenStorage] ✅ Token saved to Firestore for user ${userId}`);
          
          // Also save to file as backup
          this.fallbackStorage.saveUserToken(userId, tokenData);
          console.log(`[HybridTokenStorage] ✅ Token also backed up to file for user ${userId}`);
          return;
        }
      }
      
      // Fallback to file storage
      this.fallbackStorage.saveUserToken(userId, tokenData);
      console.log(`[HybridTokenStorage] ✅ Token saved to file storage for user ${userId}`);
    } catch (error) {
      console.error(`[HybridTokenStorage] Error saving token for user ${userId}:`, error);
      
      // Final fallback to file storage
      this.fallbackStorage.saveUserToken(userId, tokenData);
      console.log(`[HybridTokenStorage] ✅ Token saved to file storage (fallback) for user ${userId}`);
    }
  }

  async getUserToken(userId) {
    try {
      // Try Firestore first
      if (this.firestoreAvailable !== false) {
        const token = await this.primaryStorage.getUserToken(userId);
        if (token) {
          console.log(`[HybridTokenStorage] ✅ Token retrieved from Firestore for user ${userId}`);
          return token;
        }
      }
      
      // Fallback to file storage
      const token = this.fallbackStorage.getUserToken(userId);
      if (token) {
        console.log(`[HybridTokenStorage] ✅ Token retrieved from file storage for user ${userId}`);
        
        // If we got a token from file but Firestore is available, sync it
        if (this.firestoreAvailable === true) {
          console.log(`[HybridTokenStorage] 🔄 Syncing token to Firestore for user ${userId}`);
          await this.primaryStorage.saveUserToken(userId, token);
        }
      }
      
      return token;
    } catch (error) {
      console.error(`[HybridTokenStorage] Error getting token for user ${userId}:`, error);
      
      // Final fallback to file storage
      return this.fallbackStorage.getUserToken(userId);
    }
  }

  async removeUserToken(userId) {
    try {
      let removed = false;
      
      // Try to remove from both storages
      if (this.firestoreAvailable !== false) {
        const firestoreRemoved = await this.primaryStorage.removeUserToken(userId);
        if (firestoreRemoved) {
          console.log(`[HybridTokenStorage] ✅ Token removed from Firestore for user ${userId}`);
          removed = true;
        }
      }
      
      // Also remove from file storage
      this.fallbackStorage.removeUserToken(userId);
      console.log(`[HybridTokenStorage] ✅ Token removed from file storage for user ${userId}`);
      
      return true;
    } catch (error) {
      console.error(`[HybridTokenStorage] Error removing token for user ${userId}:`, error);
      
      // Final fallback
      this.fallbackStorage.removeUserToken(userId);
      return true;
    }
  }

  async hasValidToken(userId) {
    try {
      // Try Firestore first
      if (this.firestoreAvailable !== false) {
        const hasValid = await this.primaryStorage.hasValidToken(userId);
        if (hasValid) {
          return true;
        }
      }
      
      // Fallback to file storage
      return this.fallbackStorage.hasValidToken(userId);
    } catch (error) {
      console.error(`[HybridTokenStorage] Error checking token validity for user ${userId}:`, error);
      return this.fallbackStorage.hasValidToken(userId);
    }
  }

  async refreshTokenIfNeeded(userId) {
    try {
      // Try Firestore first
      if (this.firestoreAvailable !== false) {
        const refreshedToken = await this.primaryStorage.refreshTokenIfNeeded(userId);
        if (refreshedToken) {
          // Sync to file storage as backup
          this.fallbackStorage.saveUserToken(userId, refreshedToken);
          return refreshedToken;
        }
      }
      
      // Fallback to file storage
      return await this.fallbackStorage.refreshTokenIfNeeded(userId);
    } catch (error) {
      console.error(`[HybridTokenStorage] Error refreshing token for user ${userId}:`, error);
      return await this.fallbackStorage.refreshTokenIfNeeded(userId);
    }
  }

  async getValidToken(userId) {
    try {
      console.log(`[HybridTokenStorage] Getting valid token for user ${userId}...`);
      
      // Try Firestore first
      if (this.firestoreAvailable !== false) {
        const token = await this.primaryStorage.getValidToken(userId);
        if (token) {
          console.log(`[HybridTokenStorage] ✅ Valid token retrieved from Firestore for user ${userId}`);
          // Sync to file storage as backup
          this.fallbackStorage.saveUserToken(userId, token);
          return token;
        }
      }
      
      // Fallback to file storage
      const token = await this.fallbackStorage.getValidToken(userId);
      if (token) {
        console.log(`[HybridTokenStorage] ✅ Valid token retrieved from file storage for user ${userId}`);
        
        // If we got a token from file but Firestore is available, sync it
        if (this.firestoreAvailable === true) {
          console.log(`[HybridTokenStorage] 🔄 Syncing token to Firestore for user ${userId}`);
          await this.primaryStorage.saveUserToken(userId, token);
        }
      }
      
      return token;
    } catch (error) {
      console.error(`[HybridTokenStorage] Error getting valid token for user ${userId}:`, error);
      console.warn(`[HybridTokenStorage] No valid token available for user ${userId}`);
      return null;
    }
  }

  async healthCheck() {
    const firestoreHealth = await this.primaryStorage.healthCheck();
    const fileHealth = { status: 'healthy', storage: 'file-based' };
    
    return {
      primary: firestoreHealth,
      fallback: fileHealth,
      activeStorage: this.firestoreAvailable ? 'firestore' : 'file',
      hybrid: true
    };
  }
}

// Create singleton instance
const hybridTokenStorage = new HybridTokenStorage();

export default hybridTokenStorage;
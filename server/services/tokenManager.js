import firestoreTokenStorage from './firestoreTokenStorage.js';

/**
 * Token Manager - Centralized token management using Firestore
 * This replaces the in-memory tokenStore with persistent Firestore storage
 */
class TokenManager {
  constructor() {
    // Legacy in-memory fallback (only used if Firestore fails)
    this.memoryStore = new Map();
  }

  /**
   * Save user tokens to Firestore
   */
  async saveTokens(userId, tokenData) {
    try {
      console.log(`[TokenManager] Saving tokens for user ${userId}`);

      // Always save to Firestore first
      const saved = await firestoreTokenStorage.saveUserToken(userId, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3600,
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || '',
        expiry_date: tokenData.expiry_date
      });

      // Also keep in memory as fallback
      this.memoryStore.set(userId, {
        tokens: tokenData,
        userInfo: tokenData.userInfo || null,
        timestamp: Date.now()
      });

      console.log(`[TokenManager] ✅ Tokens saved for user ${userId} (Firestore: ${saved ? 'yes' : 'fallback-only'})`);
      return saved;
    } catch (error) {
      console.error(`[TokenManager] Error saving tokens:`, error);

      // Fallback to memory only
      this.memoryStore.set(userId, {
        tokens: tokenData,
        userInfo: tokenData.userInfo || null,
        timestamp: Date.now()
      });

      return false;
    }
  }

  /**
   * Get valid tokens for a user (with automatic refresh)
   */
  async getValidTokens(userId) {
    try {
      console.log(`[TokenManager] Getting valid tokens for user ${userId}`);

      // Try Firestore first (with automatic refresh)
      const firestoreTokens = await firestoreTokenStorage.getValidToken(userId);

      if (firestoreTokens && firestoreTokens.access_token) {
        console.log(`[TokenManager] ✅ Found valid tokens in Firestore for user ${userId}`);
        return firestoreTokens;
      }

      // Fallback to memory store
      const memoryData = this.memoryStore.get(userId);
      if (memoryData && memoryData.tokens) {
        console.log(`[TokenManager] Found tokens in memory for user ${userId}`);

        // Try to migrate to Firestore
        await this.saveTokens(userId, memoryData.tokens);

        return memoryData.tokens;
      }

      console.log(`[TokenManager] No tokens found for user ${userId}`);
      return null;
    } catch (error) {
      console.error(`[TokenManager] Error getting tokens:`, error);

      // Final fallback to memory
      const memoryData = this.memoryStore.get(userId);
      return memoryData?.tokens || null;
    }
  }

  /**
   * Get tokens by access token (find user)
   */
  async getTokensByAccessToken(accessToken) {
    try {
      // Check memory store first for quick lookup
      for (const [userId, userData] of this.memoryStore.entries()) {
        if (userData.tokens.access_token === accessToken) {
          console.log(`[TokenManager] Found user ${userId} by access token in memory`);

          // Verify in Firestore and return fresh tokens
          const firestoreTokens = await firestoreTokenStorage.getValidToken(userId);
          if (firestoreTokens) {
            return { userId, tokens: firestoreTokens };
          }

          return { userId, tokens: userData.tokens };
        }
      }

      console.log(`[TokenManager] No user found for access token`);
      return null;
    } catch (error) {
      console.error(`[TokenManager] Error finding tokens by access token:`, error);
      return null;
    }
  }

  /**
   * Remove user tokens
   */
  async removeTokens(userId) {
    try {
      console.log(`[TokenManager] Removing tokens for user ${userId}`);

      // Remove from Firestore
      await firestoreTokenStorage.removeUserToken(userId);

      // Remove from memory
      this.memoryStore.delete(userId);

      console.log(`[TokenManager] ✅ Tokens removed for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`[TokenManager] Error removing tokens:`, error);
      return false;
    }
  }

  /**
   * Check if user has valid tokens
   */
  async hasValidTokens(userId) {
    const tokens = await this.getValidTokens(userId);
    return tokens && tokens.access_token ? true : false;
  }

  /**
   * Update tokens (after refresh)
   */
  async updateTokens(userId, newTokenData) {
    return await this.saveTokens(userId, newTokenData);
  }

  /**
   * Get all users with tokens (for migration/debugging)
   */
  getAllMemoryUsers() {
    return Array.from(this.memoryStore.keys());
  }

  /**
   * Migrate all memory tokens to Firestore
   */
  async migrateAllToFirestore() {
    console.log(`[TokenManager] Migrating all memory tokens to Firestore...`);
    let migrated = 0;

    for (const [userId, userData] of this.memoryStore.entries()) {
      try {
        const saved = await this.saveTokens(userId, userData.tokens);
        if (saved) migrated++;
      } catch (error) {
        console.error(`[TokenManager] Failed to migrate user ${userId}:`, error);
      }
    }

    console.log(`[TokenManager] ✅ Migrated ${migrated} users to Firestore`);
    return migrated;
  }
}

// Create singleton instance
const tokenManager = new TokenManager();

export default tokenManager;

import connectionPool from '../database/connectionPool.js';
import cacheManager from '../cache/cacheManager.js';
import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Supabase Token Storage
 * UPDATED: Now uses the NEW schema (users table) instead of user_tokens table
 * Tokens are stored directly in the users table columns:
 * - google_access_token
 * - google_refresh_token
 * - google_token_expiry
 * - has_valid_token
 * - token_last_refreshed
 */
class SupabaseTokenStorage {
  constructor() {
    this.client = null;
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    this.initialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initialized) {
      return this.client;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('[SupabaseTokenStorage] Initializing connection from pool...');
      this.client = await connectionPool.getClient();
      this.initialized = true;
      console.log('[SupabaseTokenStorage] ✅ Using centralized connection pool (NEW SCHEMA - users table)');
      return this.client;
    } catch (error) {
      console.error('[SupabaseTokenStorage] ❌ Failed to get connection:', error.message);
      this.initialized = false;
      this.client = null;
      throw error;
    }
  }

  /**
   * Encrypt sensitive token data
   */
  encrypt(text) {
    try {
      if (!text) return null;

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('[SupabaseTokenStorage] Encryption error:', error);
      console.warn('[SupabaseTokenStorage] ⚠️ Storing token unencrypted due to encryption failure');
      return `UNENCRYPTED:${text}`;
    }
  }

  /**
   * Decrypt sensitive token data
   */
  decrypt(encryptedText) {
    try {
      if (!encryptedText) return null;

      // Handle unencrypted tokens
      if (encryptedText.startsWith('UNENCRYPTED:')) {
        console.warn('[SupabaseTokenStorage] ⚠️ Reading unencrypted token');
        return encryptedText.substring(12);
      }

      // Handle plain tokens (not encrypted)
      if (!encryptedText.includes(':') || encryptedText.startsWith('ya29.')) {
        return encryptedText;
      }

      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        // Might be a plain token
        return encryptedText;
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[SupabaseTokenStorage] Decryption error:', error);
      // Return as-is if decryption fails (might be a plain token)
      return encryptedText;
    }
  }

  /**
   * Save user token to users table
   * userId can be firebase_uid or gmail_id
   */
  async saveUserToken(userId, tokenData) {
    try {
      console.log(`[SupabaseTokenStorage] ========================================`);
      console.log(`[SupabaseTokenStorage] 💾 SAVE USER TOKEN: ${userId}`);

      await this.initialize();

      if (!this.client) {
        throw new Error('Supabase not available');
      }

      // Calculate expiry timestamp
      const expiresAt = tokenData.expiry_date
        ? new Date(tokenData.expiry_date)
        : new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

      // Prepare update data for users table
      const updateData = {
        google_access_token: tokenData.access_token, // Store plain for now
        google_refresh_token: tokenData.refresh_token || null,
        google_token_expiry: expiresAt.getTime(),
        has_valid_token: true,
        token_last_refreshed: new Date().toISOString(),
        token_error: null,
        updated_at: new Date().toISOString()
      };

      // Try to update by firebase_uid first, then by gmail_id
      let updateResult;
      if (!userId.includes('@')) {
        // userId is firebase_uid
        updateResult = await this.client
          .from('users')
          .update(updateData)
          .eq('firebase_uid', userId);
      } else {
        // userId is gmail_id
        updateResult = await this.client
          .from('users')
          .update(updateData)
          .eq('gmail_id', userId);
      }

      if (updateResult.error) {
        console.error(`[SupabaseTokenStorage] ❌ Error saving token:`, updateResult.error);
        throw updateResult.error;
      }

      console.log(`[SupabaseTokenStorage] ✅ Token saved successfully for user ${userId}`);
      console.log(`[SupabaseTokenStorage] Expires at: ${expiresAt.toISOString()}`);

      // Invalidate cache since token was updated
      const cacheKey = cacheManager.getTokenKey(userId);
      cacheManager.delete(cacheKey);

      console.log(`[SupabaseTokenStorage] ========================================`);

      return true;
    } catch (error) {
      console.error(`[SupabaseTokenStorage] Failed to save token for user ${userId}:`, error);
      console.log(`[SupabaseTokenStorage] ========================================`);
      throw error;
    }
  }

  /**
   * Get user token from users table (with caching)
   */
  async getUserToken(userId) {
    try {
      console.log(`[SupabaseTokenStorage] ========================================`);
      console.log(`[SupabaseTokenStorage] 🔍 GET USER TOKEN: ${userId}`);

      // Check cache first
      const cacheKey = cacheManager.getTokenKey(userId);
      const cached = cacheManager.get(cacheKey);

      if (cached) {
        console.log(`[SupabaseTokenStorage] ✅ Cache HIT for user ${userId}`);
        console.log(`[SupabaseTokenStorage] ========================================`);
        return cached;
      }

      console.log(`[SupabaseTokenStorage] ❌ Cache MISS for user ${userId}`);

      await this.initialize();

      if (!this.client) {
        console.log(`[SupabaseTokenStorage] ❌ Supabase not available, no token for user ${userId}`);
        console.log(`[SupabaseTokenStorage] ========================================`);
        return null;
      }

      // Fetch user from users table
      let query;
      if (!userId.includes('@')) {
        // userId is firebase_uid
        query = this.client
          .from('users')
          .select('gmail_id, firebase_uid, google_access_token, google_refresh_token, google_token_expiry, has_valid_token')
          .eq('firebase_uid', userId);
      } else {
        // userId is gmail_id
        query = this.client
          .from('users')
          .select('gmail_id, firebase_uid, google_access_token, google_refresh_token, google_token_expiry, has_valid_token')
          .eq('gmail_id', userId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[SupabaseTokenStorage] ❌ No user found for: ${userId}`);
          console.log(`[SupabaseTokenStorage] 💡 User needs to connect Google Business Profile`);
          console.log(`[SupabaseTokenStorage] ========================================`);
          return null;
        }
        throw error;
      }

      if (!data || !data.google_access_token) {
        console.log(`[SupabaseTokenStorage] ❌ No token data for user ${userId}`);
        console.log(`[SupabaseTokenStorage] ========================================`);
        return null;
      }

      // Construct token object
      const tokenData = {
        access_token: this.decrypt(data.google_access_token),
        refresh_token: data.google_refresh_token ? this.decrypt(data.google_refresh_token) : null,
        token_type: 'Bearer',
        expires_in: 3600,
        expiry_date: data.google_token_expiry,
        userId: data.gmail_id,
        firebaseUid: data.firebase_uid
      };

      // Check if token is expired
      const now = Date.now();
      if (data.google_token_expiry && data.google_token_expiry < now) {
        console.log(`[SupabaseTokenStorage] ⚠️ Token expired for user ${userId}`);
        console.log(`[SupabaseTokenStorage] Expired at: ${new Date(data.google_token_expiry).toISOString()}`);
        console.log(`[SupabaseTokenStorage] Will attempt refresh if refresh_token exists`);
      } else {
        console.log(`[SupabaseTokenStorage] ✅ Token found for user ${userId}`);
        console.log(`[SupabaseTokenStorage] Expires at: ${new Date(data.google_token_expiry).toISOString()}`);

        // Cache valid tokens for 2 minutes
        cacheManager.set(cacheKey, tokenData, 120);
      }

      console.log(`[SupabaseTokenStorage] ========================================`);
      return tokenData;
    } catch (error) {
      console.error(`[SupabaseTokenStorage] Error getting token for user ${userId}:`, error);
      console.log(`[SupabaseTokenStorage] ========================================`);
      return null;
    }
  }

  /**
   * Get valid token (with automatic refresh)
   */
  async getValidToken(userId) {
    try {
      console.log(`[SupabaseTokenStorage] ========================================`);
      console.log(`[SupabaseTokenStorage] 🔄 GET VALID TOKEN (with auto-refresh): ${userId}`);

      const token = await this.getUserToken(userId);

      if (!token) {
        console.log(`[SupabaseTokenStorage] ❌ No valid token available for user ${userId}`);
        console.log(`[SupabaseTokenStorage] 💡 SOLUTION: User needs to reconnect Google Business Profile`);
        console.log(`[SupabaseTokenStorage] ========================================`);
        return null;
      }

      // Check if token is expired OR will expire soon (AGGRESSIVE REFRESH)
      const now = Date.now();
      const expiryDate = token.expiry_date;
      const REFRESH_BUFFER_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
      const timeUntilExpiry = expiryDate - now;
      const minutesUntilExpiry = Math.round(timeUntilExpiry / 1000 / 60);

      // AGGRESSIVE: Refresh if token expires in less than 30 minutes
      if (expiryDate && timeUntilExpiry < REFRESH_BUFFER_MS) {
        console.log(`[SupabaseTokenStorage] 🔄 Token expires soon (${minutesUntilExpiry} min), refreshing proactively for user ${userId}`);

        if (!token.refresh_token) {
          console.log(`[SupabaseTokenStorage] ❌ No refresh token available`);
          console.log(`[SupabaseTokenStorage] ========================================`);
          return null;
        }

        // Refresh the token
        const refreshedToken = await this.refreshToken(userId, token.refresh_token);

        if (refreshedToken) {
          console.log(`[SupabaseTokenStorage] ✅ Token refreshed successfully (new expiry: 60 min)`);
          console.log(`[SupabaseTokenStorage] ========================================`);
          return refreshedToken;
        } else {
          console.log(`[SupabaseTokenStorage] ❌ Token refresh failed - returning existing token`);
          console.log(`[SupabaseTokenStorage] ⚠️ Warning: Token may expire soon!`);
          console.log(`[SupabaseTokenStorage] ========================================`);
          return token;
        }
      }

      console.log(`[SupabaseTokenStorage] ✅ Token is valid for user ${userId} (expires in ${minutesUntilExpiry} min)`);
      console.log(`[SupabaseTokenStorage] ========================================`);
      return token;
    } catch (error) {
      console.error(`[SupabaseTokenStorage] Error getting valid token:`, error);
      console.log(`[SupabaseTokenStorage] ========================================`);
      return null;
    }
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(userId, refreshToken) {
    try {
      console.log(`[SupabaseTokenStorage] 🔄 Refreshing token for user ${userId}`);

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured');
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[SupabaseTokenStorage] Token refresh failed:`, error);

        // Mark token as invalid in users table
        await this.markTokenInvalid(userId, 'refresh_failed: ' + error);

        return null;
      }

      const newTokenData = await response.json();

      // Save new token
      await this.saveUserToken(userId, {
        access_token: newTokenData.access_token,
        refresh_token: refreshToken, // Keep the same refresh token
        expires_in: newTokenData.expires_in || 3600,
        token_type: newTokenData.token_type,
        scope: newTokenData.scope
      });

      console.log(`[SupabaseTokenStorage] ✅ Token refreshed and saved for user ${userId}`);

      return {
        access_token: newTokenData.access_token,
        refresh_token: refreshToken,
        expires_in: newTokenData.expires_in || 3600,
        token_type: newTokenData.token_type,
        scope: newTokenData.scope,
        expiry_date: Date.now() + (newTokenData.expires_in || 3600) * 1000
      };
    } catch (error) {
      console.error(`[SupabaseTokenStorage] Error refreshing token:`, error);
      await this.markTokenInvalid(userId, error.message);
      return null;
    }
  }

  /**
   * Mark token as invalid in users table
   */
  async markTokenInvalid(userId, errorMessage) {
    try {
      await this.initialize();

      const updateData = {
        has_valid_token: false,
        token_error: errorMessage,
        updated_at: new Date().toISOString()
      };

      if (!userId.includes('@')) {
        await this.client
          .from('users')
          .update(updateData)
          .eq('firebase_uid', userId);
      } else {
        await this.client
          .from('users')
          .update(updateData)
          .eq('gmail_id', userId);
      }
    } catch (error) {
      console.error('[SupabaseTokenStorage] Error marking token invalid:', error);
    }
  }

  /**
   * Remove user token
   */
  async removeUserToken(userId) {
    try {
      console.log(`[SupabaseTokenStorage] Removing token for user ${userId}`);

      await this.initialize();

      if (!this.client) {
        return false;
      }

      const updateData = {
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        has_valid_token: false,
        updated_at: new Date().toISOString()
      };

      if (!userId.includes('@')) {
        await this.client
          .from('users')
          .update(updateData)
          .eq('firebase_uid', userId);
      } else {
        await this.client
          .from('users')
          .update(updateData)
          .eq('gmail_id', userId);
      }

      console.log(`[SupabaseTokenStorage] ✅ Token removed for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`[SupabaseTokenStorage] Error removing token:`, error);
      return false;
    }
  }

  /**
   * Log token failure for debugging
   */
  async logTokenFailure(userId, failureData) {
    if (!userId || !failureData) {
      return;
    }

    try {
      await this.initialize();

      // Update users table with error info
      const updateData = {
        token_error: typeof failureData === 'string' ? failureData : JSON.stringify(failureData),
        updated_at: new Date().toISOString()
      };

      if (!userId.includes('@')) {
        await this.client
          .from('users')
          .update(updateData)
          .eq('firebase_uid', userId);
      } else {
        await this.client
          .from('users')
          .update(updateData)
          .eq('gmail_id', userId);
      }

      console.log(`[SupabaseTokenStorage] 📝 Token failure logged for user ${userId}`);
    } catch (error) {
      console.error('[SupabaseTokenStorage] ❌ Error logging token failure:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          status: 'not_initialized',
          storage: 'supabase (users table)',
          message: 'Supabase not initialized'
        };
      }

      await this.initialize();

      const { data, error } = await this.client
        .from('users')
        .select('gmail_id')
        .limit(1);

      if (error) {
        return {
          status: 'error',
          storage: 'supabase (users table)',
          message: error.message
        };
      }

      return {
        status: 'healthy',
        storage: 'supabase (users table)',
        message: 'Supabase token storage operational (using users table)'
      };
    } catch (error) {
      return {
        status: 'error',
        storage: 'supabase (users table)',
        message: error.message
      };
    }
  }

  /**
   * Get ANY valid token from users with valid tokens
   * Used as fallback when specific user's token is expired/missing
   */
  async getAnyValidToken() {
    try {
      console.log('[SupabaseTokenStorage] 🔄 Searching for ANY valid token in pool...');

      await this.initialize();

      if (!this.client) {
        console.log('[SupabaseTokenStorage] ❌ Supabase not available');
        return null;
      }

      const now = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer before expiry

      // Get users with valid tokens, ordered by token expiry (freshest first)
      const { data: users, error } = await this.client
        .from('users')
        .select('gmail_id, firebase_uid, google_access_token, google_refresh_token, google_token_expiry, has_valid_token')
        .eq('has_valid_token', true)
        .not('google_access_token', 'is', null)
        .order('google_token_expiry', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[SupabaseTokenStorage] Error fetching token pool:', error);
        return null;
      }

      if (!users || users.length === 0) {
        console.log('[SupabaseTokenStorage] ❌ No users with valid tokens found');
        return null;
      }

      console.log(`[SupabaseTokenStorage] 📊 Found ${users.length} user(s) with tokens`);

      // Try to find a valid non-expired token
      for (const user of users) {
        const expiryDate = user.google_token_expiry;

        // Check if token is still valid (with buffer)
        if (expiryDate && expiryDate > (now + bufferTime)) {
          try {
            const token = {
              access_token: this.decrypt(user.google_access_token),
              refresh_token: user.google_refresh_token ? this.decrypt(user.google_refresh_token) : null,
              token_type: 'Bearer',
              expiry_date: expiryDate,
              fromPool: true,
              poolUserId: user.gmail_id
            };

            console.log(`[SupabaseTokenStorage] ✅ Found valid token from user: ${user.gmail_id}`);
            console.log(`[SupabaseTokenStorage]    Expires: ${new Date(expiryDate).toISOString()}`);
            return token;
          } catch (decryptError) {
            console.log(`[SupabaseTokenStorage] ⚠️ Could not process token for ${user.gmail_id}:`, decryptError.message);
            continue;
          }
        }
      }

      // All tokens expired - try refreshing
      console.log('[SupabaseTokenStorage] All tokens expired, attempting refresh...');

      for (const user of users) {
        if (user.google_refresh_token) {
          try {
            console.log(`[SupabaseTokenStorage] 🔄 Attempting refresh for user: ${user.gmail_id}`);
            const decryptedRefreshToken = this.decrypt(user.google_refresh_token);
            const refreshed = await this.refreshToken(user.gmail_id, decryptedRefreshToken);

            if (refreshed) {
              refreshed.fromPool = true;
              refreshed.poolUserId = user.gmail_id;
              console.log(`[SupabaseTokenStorage] ✅ Refreshed token from pool user: ${user.gmail_id}`);
              return refreshed;
            }
          } catch (refreshError) {
            console.log(`[SupabaseTokenStorage] ⚠️ Refresh failed for ${user.gmail_id}:`, refreshError.message);
            continue;
          }
        }
      }

      console.log('[SupabaseTokenStorage] ❌ No valid tokens available in pool after refresh attempts');
      return null;
    } catch (error) {
      console.error('[SupabaseTokenStorage] ❌ Error in getAnyValidToken:', error);
      return null;
    }
  }
}

// Create singleton instance
const supabaseTokenStorage = new SupabaseTokenStorage();

export default supabaseTokenStorage;

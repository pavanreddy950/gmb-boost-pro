import connectionPool from '../database/connectionPool.js';
import cacheManager from '../cache/cacheManager.js';
import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Supabase Token Storage
 * Now using centralized connection pool and caching for scalability
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
      console.log('[SupabaseTokenStorage] ✅ Using centralized connection pool');
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

      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[SupabaseTokenStorage] Decryption error:', error);
      return encryptedText;
    }
  }

  /**
   * Save user token to Supabase
   */
  async saveUserToken(userId, tokenData) {
    try {
      console.log(`[SupabaseTokenStorage] ========================================`);
      console.log(`[SupabaseTokenStorage] 💾 SAVE USER TOKEN: ${userId}`);

      await this.initialize();

      if (!this.client) {
        throw new Error('Supabase not available');
      }

      // Encrypt sensitive tokens
      const encryptedAccessToken = this.encrypt(tokenData.access_token);
      const encryptedRefreshToken = tokenData.refresh_token ? this.encrypt(tokenData.refresh_token) : null;

      // Calculate expiry timestamp
      const expiresAt = tokenData.expiry_date
        ? new Date(tokenData.expiry_date)
        : new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

      // Prepare token record
      const tokenRecord = {
        user_id: userId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || '',
        expires_at: expiresAt.toISOString(),
        expiry_date: tokenData.expiry_date || Date.now() + (tokenData.expires_in || 3600) * 1000,
        user_info: tokenData.userInfo || null,
        updated_at: new Date().toISOString()
      };

      // Upsert token (insert or update)
      const { data, error } = await this.client
        .from('user_tokens')
        .upsert(tokenRecord, {
          onConflict: 'user_id',
          returning: 'minimal'
        });

      if (error) {
        console.error(`[SupabaseTokenStorage] ❌ Error saving token:`, error);
        throw error;
      }

      console.log(`[SupabaseTokenStorage] ✅ Token saved successfully for user ${userId}`);
      console.log(`[SupabaseTokenStorage] Expires at: ${expiresAt.toISOString()}`);

      // Invalidate cache since token was updated
      const cacheKey = cacheManager.getTokenKey(userId);
      cacheManager.delete(cacheKey);
      console.log(`[SupabaseTokenStorage] 🔄 Cache invalidated for user ${userId}`);

      console.log(`[SupabaseTokenStorage] ========================================`);

      return true;
    } catch (error) {
      console.error(`[SupabaseTokenStorage] Failed to save token for user ${userId}:`, error);
      console.log(`[SupabaseTokenStorage] ========================================`);
      throw error;
    }
  }

  /**
   * Get user token from Supabase (with caching)
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

      // Fetch token from database
      const { data, error } = await this.client
        .from('user_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - user needs to connect
          console.log(`[SupabaseTokenStorage] ❌ No token found for user ${userId}`);
          console.log(`[SupabaseTokenStorage] 💡 User needs to connect Google Business Profile`);
          console.log(`[SupabaseTokenStorage] ========================================`);
          return null;
        }
        throw error;
      }

      if (!data) {
        console.log(`[SupabaseTokenStorage] ❌ No token data for user ${userId}`);
        console.log(`[SupabaseTokenStorage] ========================================`);
        return null;
      }

      // Decrypt tokens
      const decryptedTokens = {
        access_token: this.decrypt(data.access_token),
        refresh_token: data.refresh_token ? this.decrypt(data.refresh_token) : null,
        token_type: data.token_type,
        scope: data.scope,
        expires_in: 3600, // Default
        expiry_date: data.expiry_date,
        userInfo: data.user_info
      };

      // Check if token is expired
      const now = Date.now();
      if (data.expiry_date && data.expiry_date < now) {
        console.log(`[SupabaseTokenStorage] ⚠️ Token expired for user ${userId}`);
        console.log(`[SupabaseTokenStorage] Expired at: ${new Date(data.expiry_date).toISOString()}`);
        console.log(`[SupabaseTokenStorage] Will attempt refresh if refresh_token exists`);
      } else {
        console.log(`[SupabaseTokenStorage] ✅ Token found for user ${userId}`);
        console.log(`[SupabaseTokenStorage] Expires at: ${new Date(data.expiry_date).toISOString()}`);

        // Cache valid tokens for 2 minutes
        cacheManager.set(cacheKey, decryptedTokens, 120);
      }

      console.log(`[SupabaseTokenStorage] ========================================`);
      return decryptedTokens;
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
          // Return existing token even if refresh failed - it might still work
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

        // Log refresh failure
        await this.logTokenFailure(userId, 'refresh_failed', error);

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
      await this.logTokenFailure(userId, 'refresh_error', error.message);
      return null;
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
        console.log(`[SupabaseTokenStorage] Supabase not available, cannot remove token`);
        return false;
      }

      const { error } = await this.client
        .from('user_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error(`[SupabaseTokenStorage] Error removing token:`, error);
        return false;
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
  async logTokenFailure(userId, errorType, errorMessage) {
    try {
      await this.initialize();

      if (!this.client) return;

      await this.client
        .from('token_failures')
        .insert({
          user_id: userId,
          error_type: errorType,
          error_message: String(errorMessage).substring(0, 1000),
          error_details: { timestamp: new Date().toISOString() }
        });
    } catch (error) {
      console.error('[SupabaseTokenStorage] Error logging token failure:', error);
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
          storage: 'supabase',
          message: 'Supabase not initialized'
        };
      }

      await this.initialize();

      const { data, error } = await this.client
        .from('user_tokens')
        .select('count')
        .limit(1);

      if (error) {
        return {
          status: 'error',
          storage: 'supabase',
          message: error.message
        };
      }

      return {
        status: 'healthy',
        storage: 'supabase',
        message: 'Supabase token storage operational'
      };
    } catch (error) {
      return {
        status: 'error',
        storage: 'supabase',
        message: error.message
      };
    }
  }

  /**
   * Log token failure for monitoring and debugging
   * Tracks automation failures due to expired/revoked tokens
   *
   * @param {string} userId - User ID
   * @param {object} failureData - Failure details (operation, reason, locationId, etc.)
   */
  async logTokenFailure(userId, failureData) {
    if (!userId || !failureData) {
      console.warn('[SupabaseTokenStorage] logTokenFailure called with missing parameters');
      return;
    }

    try {
      await this.initialize();

      const failureRecord = {
        user_id: userId,
        operation: failureData.operation || 'unknown',
        reason: failureData.reason || 'unknown',
        location_id: failureData.locationId || null,
        error_details: JSON.stringify({
          timestamp: new Date().toISOString(),
          ...failureData
        }),
        created_at: new Date().toISOString()
      };

      console.log('[SupabaseTokenStorage] 📝 Logging token failure:', {
        userId,
        operation: failureRecord.operation,
        reason: failureRecord.reason,
        locationId: failureRecord.location_id
      });

      const { error } = await this.client
        .from('token_failures')
        .insert(failureRecord);

      if (error) {
        console.error('[SupabaseTokenStorage] ❌ Failed to log token failure:', error.message);
      } else {
        console.log('[SupabaseTokenStorage] ✅ Token failure logged successfully');
      }

    } catch (error) {
      console.error('[SupabaseTokenStorage] ❌ Error logging token failure:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Get ANY valid token from the pool
   * Used as fallback when specific user's token is expired/missing
   * This enables shared token pool across all locations for reliability
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

      // Get all tokens, ordered by expiry (freshest first)
      const { data: tokens, error } = await this.client
        .from('user_tokens')
        .select('*')
        .order('expiry_date', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[SupabaseTokenStorage] Error fetching token pool:', error);
        return null;
      }

      if (!tokens || tokens.length === 0) {
        console.log('[SupabaseTokenStorage] ❌ No tokens in pool');
        return null;
      }

      console.log(`[SupabaseTokenStorage] 📊 Found ${tokens.length} token(s) in pool`);

      // Try to find a valid non-expired token
      for (const tokenRecord of tokens) {
        const expiryDate = tokenRecord.expiry_date;

        // Check if token is still valid (with buffer)
        if (expiryDate && expiryDate > (now + bufferTime)) {
          try {
            const decryptedToken = {
              access_token: this.decrypt(tokenRecord.access_token),
              refresh_token: tokenRecord.refresh_token ? this.decrypt(tokenRecord.refresh_token) : null,
              token_type: tokenRecord.token_type || 'Bearer',
              scope: tokenRecord.scope,
              expiry_date: expiryDate,
              expiresAt: expiryDate,
              fromPool: true,
              poolUserId: tokenRecord.user_id
            };

            console.log(`[SupabaseTokenStorage] ✅ Found valid token from user: ${tokenRecord.user_id}`);
            console.log(`[SupabaseTokenStorage]    Expires: ${new Date(expiryDate).toISOString()}`);
            return decryptedToken;
          } catch (decryptError) {
            console.log(`[SupabaseTokenStorage] ⚠️ Could not decrypt token for ${tokenRecord.user_id}:`, decryptError.message);
            continue;
          }
        }
      }

      // All tokens expired - try refreshing
      console.log('[SupabaseTokenStorage] All tokens expired, attempting refresh...');

      for (const tokenRecord of tokens) {
        if (tokenRecord.refresh_token) {
          try {
            console.log(`[SupabaseTokenStorage] 🔄 Attempting refresh for user: ${tokenRecord.user_id}`);
            const decryptedRefreshToken = this.decrypt(tokenRecord.refresh_token);
            const refreshed = await this.refreshAndSaveToken(tokenRecord.user_id, decryptedRefreshToken);

            if (refreshed) {
              refreshed.fromPool = true;
              refreshed.poolUserId = tokenRecord.user_id;
              console.log(`[SupabaseTokenStorage] ✅ Refreshed token from pool user: ${tokenRecord.user_id}`);
              return refreshed;
            }
          } catch (refreshError) {
            console.log(`[SupabaseTokenStorage] ⚠️ Refresh failed for ${tokenRecord.user_id}:`, refreshError.message);
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





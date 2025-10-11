import supabaseConfig from '../config/supabase.js';
import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Supabase Token Storage
 * Replaces FirestoreTokenStorage with PostgreSQL storage via Supabase
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
      console.log('[SupabaseTokenStorage] Initializing Supabase connection...');
      this.client = await supabaseConfig.ensureInitialized();
      this.initialized = true;
      console.log('[SupabaseTokenStorage] ✅ Supabase connection established');
      return this.client;
    } catch (error) {
      console.error('[SupabaseTokenStorage] ❌ Failed to initialize Supabase:', error.message);
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
      console.log(`[SupabaseTokenStorage] ========================================`);

      return true;
    } catch (error) {
      console.error(`[SupabaseTokenStorage] Failed to save token for user ${userId}:`, error);
      console.log(`[SupabaseTokenStorage] ========================================`);
      throw error;
    }
  }

  /**
   * Get user token from Supabase
   */
  async getUserToken(userId) {
    try {
      console.log(`[SupabaseTokenStorage] ========================================`);
      console.log(`[SupabaseTokenStorage] 🔍 GET USER TOKEN: ${userId}`);

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

      // Check if token is expired
      const now = Date.now();
      const expiryDate = token.expiry_date;

      if (expiryDate && expiryDate < now) {
        console.log(`[SupabaseTokenStorage] 🔄 Token expired, attempting refresh for user ${userId}`);

        if (!token.refresh_token) {
          console.log(`[SupabaseTokenStorage] ❌ No refresh token available`);
          console.log(`[SupabaseTokenStorage] ========================================`);
          return null;
        }

        // Refresh the token
        const refreshedToken = await this.refreshToken(userId, token.refresh_token);

        if (refreshedToken) {
          console.log(`[SupabaseTokenStorage] ✅ Token refreshed successfully`);
          console.log(`[SupabaseTokenStorage] ========================================`);
          return refreshedToken;
        } else {
          console.log(`[SupabaseTokenStorage] ❌ Token refresh failed`);
          console.log(`[SupabaseTokenStorage] ========================================`);
          return null;
        }
      }

      console.log(`[SupabaseTokenStorage] ✅ Token is valid for user ${userId}`);
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
}

// Create singleton instance
const supabaseTokenStorage = new SupabaseTokenStorage();

export default supabaseTokenStorage;





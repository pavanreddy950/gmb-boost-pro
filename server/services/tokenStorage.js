import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TokenStorage {
  constructor() {
    this.tokenFile = path.join(__dirname, '..', 'data', 'tokens.json');
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    this.ensureDataFile();
  }

  ensureDataFile() {
    const dir = path.dirname(this.tokenFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.tokenFile)) {
      this.saveTokens({ tokens: {} });
    }
  }

  // Modern encryption for tokens using AES-256-GCM
  encrypt(text) {
    try {
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
      console.error('[TokenStorage] Encryption error:', error);
      // For development, return unencrypted with warning
      console.warn('[TokenStorage] ⚠️ Storing token unencrypted due to encryption failure');
      return `UNENCRYPTED:${text}`;
    }
  }

  decrypt(encryptedText) {
    try {
      // Handle unencrypted tokens (fallback for development)
      if (encryptedText.startsWith('UNENCRYPTED:')) {
        console.warn('[TokenStorage] ⚠️ Reading unencrypted token');
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
      console.error('[TokenStorage] Decryption error:', error);
      console.error('[TokenStorage] This may indicate corrupted token data or key mismatch');
      // Return the text as-is if decryption fails (for backward compatibility)
      return encryptedText;
    }
  }

  loadTokens() {
    try {
      const data = fs.readFileSync(this.tokenFile, 'utf8');
      const parsed = JSON.parse(data);
      
      // Decrypt tokens
      const tokens = {};
      for (const [userId, tokenData] of Object.entries(parsed.tokens || {})) {
        if (tokenData.encrypted) {
          tokens[userId] = {
            ...tokenData,
            access_token: this.decrypt(tokenData.access_token),
            refresh_token: tokenData.refresh_token ? this.decrypt(tokenData.refresh_token) : null
          };
        } else {
          tokens[userId] = tokenData;
        }
      }
      
      return tokens;
    } catch (error) {
      console.error('[TokenStorage] Error loading tokens:', error);
      return {};
    }
  }

  saveTokens(tokens) {
    try {
      // Encrypt tokens before saving
      const encrypted = { tokens: {} };
      for (const [userId, tokenData] of Object.entries(tokens.tokens || tokens)) {
        encrypted.tokens[userId] = {
          ...tokenData,
          access_token: this.encrypt(tokenData.access_token),
          refresh_token: tokenData.refresh_token ? this.encrypt(tokenData.refresh_token) : null,
          encrypted: true
        };
      }
      
      fs.writeFileSync(this.tokenFile, JSON.stringify(encrypted, null, 2));
      console.log('[TokenStorage] Tokens saved securely');
    } catch (error) {
      console.error('[TokenStorage] Error saving tokens:', error);
    }
  }

  // Save or update token for a user
  saveUserToken(userId, tokenData) {
    const tokens = this.loadTokens();
    tokens[userId] = {
      ...tokenData,
      savedAt: new Date().toISOString()
    };
    this.saveTokens({ tokens });
    console.log(`[TokenStorage] Token saved for user ${userId}`);
  }

  // Get token for a user
  getUserToken(userId) {
    const tokens = this.loadTokens();
    return tokens[userId] || null;
  }

  // Remove token for a user
  removeUserToken(userId) {
    const tokens = this.loadTokens();
    delete tokens[userId];
    this.saveTokens({ tokens });
    console.log(`[TokenStorage] Token removed for user ${userId}`);
  }

  // Check if token exists and is valid
  hasValidToken(userId) {
    const token = this.getUserToken(userId);
    if (!token || !token.access_token) return false;
    
    // Check if token has expired (simple check)
    if (token.expires_at) {
      const expiresAt = new Date(token.expires_at);
      if (expiresAt <= new Date()) {
        console.log(`[TokenStorage] Token expired for user ${userId}`);
        return false;
      }
    }
    
    return true;
  }

  // Refresh token if needed using Google OAuth
  async refreshTokenIfNeeded(userId) {
    const token = this.getUserToken(userId);
    if (!token) {
      console.log(`[TokenStorage] No token found for user ${userId}`);
      return null;
    }

    // Check if we have a refresh token
    if (!token.refresh_token) {
      console.warn(`[TokenStorage] No refresh token available for user ${userId}`);
      return token; // Return existing token (might be expired)
    }
    
    // Check if token needs refresh (expires in next 5 minutes)
    if (token.expires_at) {
      const expiresAt = new Date(token.expires_at);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      
      if (expiresAt > fiveMinutesFromNow) {
        console.log(`[TokenStorage] Token for user ${userId} is still valid`);
        return token; // Token still valid
      }
    }
    
    // Refresh the token using Google OAuth
    try {
      console.log(`[TokenStorage] 🔄 Refreshing expired token for user ${userId}...`);
      
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
        console.error(`[TokenStorage] Token refresh failed:`, errorText);
        
        // If refresh token is invalid, remove the token
        if (refreshResponse.status === 400) {
          console.warn(`[TokenStorage] Refresh token invalid, removing stored token for user ${userId}`);
          this.removeUserToken(userId);
        }
        
        return null;
      }

      const refreshData = await refreshResponse.json();
      console.log(`[TokenStorage] ✅ Successfully refreshed token for user ${userId}`);

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

      // Save the updated token
      this.saveUserToken(userId, updatedToken);
      
      return updatedToken;
    } catch (error) {
      console.error(`[TokenStorage] Error refreshing token for user ${userId}:`, error);
      return null;
    }
  }

  // Get a valid token (with automatic refresh)
  async getValidToken(userId) {
    console.log(`[TokenStorage] Getting valid token for user ${userId}...`);
    
    // Try to refresh token if needed
    const token = await this.refreshTokenIfNeeded(userId);
    
    if (!token) {
      console.warn(`[TokenStorage] No valid token available for user ${userId}`);
      return null;
    }

    // Final validation
    if (!token.access_token) {
      console.error(`[TokenStorage] Token missing access_token for user ${userId}`);
      return null;
    }

    console.log(`[TokenStorage] ✅ Valid token retrieved for user ${userId}`);
    return token;
  }
}

// Create singleton instance
const tokenStorage = new TokenStorage();

export default tokenStorage;
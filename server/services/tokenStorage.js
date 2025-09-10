import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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

  // Simple encryption for tokens (use proper encryption in production)
  encrypt(text) {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('[TokenStorage] Encryption error:', error);
      return text; // Return unencrypted if encryption fails
    }
  }

  decrypt(text) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(text, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('[TokenStorage] Decryption error:', error);
      return text; // Return as-is if decryption fails
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

  // Refresh token if needed
  async refreshTokenIfNeeded(userId) {
    const token = this.getUserToken(userId);
    if (!token || !token.refresh_token) return null;
    
    // Check if token needs refresh (expires in next 5 minutes)
    if (token.expires_at) {
      const expiresAt = new Date(token.expires_at);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      
      if (expiresAt > fiveMinutesFromNow) {
        return token; // Token still valid
      }
    }
    
    // Refresh the token
    try {
      console.log(`[TokenStorage] Refreshing token for user ${userId}`);
      // TODO: Implement actual token refresh with Google OAuth
      // For now, return existing token
      return token;
    } catch (error) {
      console.error(`[TokenStorage] Error refreshing token for user ${userId}:`, error);
      return null;
    }
  }
}

// Create singleton instance
const tokenStorage = new TokenStorage();

export default tokenStorage;
// Firebase Storage token storage service for Google Business Profile tokens
import { ref, uploadBytes, getDownloadURL, deleteObject, getBytes, getBlob } from 'firebase/storage';
import { storage } from './firebase';

export interface StoredGoogleTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  stored_at: number;
  expires_at: number;
}

export interface UserTokenData {
  googleTokens: StoredGoogleTokens;
  userInfo?: {
    id: string;
    email: string;
    name?: string;
    picture?: string;
  };
  lastUpdated: number;
}

class TokenStorageService {
  private readonly STORAGE_PATH = 'DATA'; // Firebase Storage path: gs://gbp-467810-a56e2.firebasestorage.app/DATA
  private isStorageAvailable = false; // DISABLED: Frontend uses ONLY backend Firestore API for persistent storage (24/7 automation)
  private readonly STORAGE_TIMEOUT = 10000; // 10 seconds timeout for better reliability

  // Save Google Business Profile tokens to Firebase Storage
  async saveTokens(userId: string, tokens: StoredGoogleTokens, userInfo?: { id: string; email: string; name?: string; picture?: string }): Promise<void> {
    if (!userId) {
      console.log('⚠️ No userId provided, skipping save');
      return;
    }

    if (!this.isStorageAvailable) {
      console.log('⚠️ Firebase Storage unavailable, skipping save');
      return;
    }

    try {
      console.log('💾 Saving tokens to Firebase Storage for user:', userId);

      // Create the token data object
      const tokenData: UserTokenData = {
        googleTokens: tokens,
        userInfo,
        lastUpdated: Date.now()
      };

      // Convert to JSON blob
      const jsonData = JSON.stringify(tokenData);
      const blob = new Blob([jsonData], { type: 'application/json' });

      // Create Firebase Storage reference: DATA/users/{userId}/tokens.json
      const tokenRef = ref(storage, `${this.STORAGE_PATH}/users/${userId}/tokens.json`);

      // Upload to Firebase Storage
      const uploadPromise = uploadBytes(tokenRef, blob);
      await this.withTimeout(uploadPromise, this.STORAGE_TIMEOUT);

      console.log('✅ Tokens saved to Firebase Storage successfully for user:', userId);

    } catch (error) {
      console.warn('⚠️ Failed to save tokens to Firebase Storage:', error);
      this.handleStorageError(error);
      // Don't throw - this allows fallback to localStorage
    }
  }

  // Get Google Business Profile tokens from Firebase Storage
  async getTokens(userId: string): Promise<StoredGoogleTokens | null> {
    if (!this.isStorageAvailable || !userId) {
      console.log('⚠️ Firebase Storage unavailable or no userId, skipping retrieval');
      return null;
    }

    try {
      console.log('📖 Retrieving tokens from Firebase Storage for user:', userId);

      // Create Firebase Storage reference: DATA/users/{userId}/tokens.json
      const tokenRef = ref(storage, `${this.STORAGE_PATH}/users/${userId}/tokens.json`);

      // Get the file content using Firebase SDK (avoids CORS issues)
      const getBytesPromise = getBytes(tokenRef);
      const bytes = await this.withTimeout(getBytesPromise, this.STORAGE_TIMEOUT);

      // Convert bytes to JSON
      const textDecoder = new TextDecoder();
      const jsonString = textDecoder.decode(bytes);
      const data = JSON.parse(jsonString) as UserTokenData;
      const tokens = data.googleTokens;

      // Check if tokens are expired
      const now = Date.now();
      if (tokens.expires_at && now >= tokens.expires_at) {
        console.log('⚠️ Tokens are expired, removing from Firebase Storage');
        // Don't await this to avoid blocking
        this.deleteTokens(userId).catch(e => console.warn('Failed to delete expired tokens:', e));
        return null;
      }

      console.log('✅ Tokens retrieved from Firebase Storage successfully for user:', userId);
      return tokens;
    } catch (error) {
      console.warn('⚠️ Error retrieving tokens from Firebase Storage:', error);
      this.handleStorageError(error);
      return null;
    }
  }

  // Delete Google Business Profile tokens from Firebase Storage
  async deleteTokens(userId: string): Promise<void> {
    if (!this.isStorageAvailable || !userId) {
      console.log('⚠️ Firebase Storage unavailable or no userId, skipping delete');
      return;
    }

    try {
      console.log('🗑️ Deleting tokens from Firebase Storage for user:', userId);

      // Create Firebase Storage reference: DATA/users/{userId}/tokens.json
      const tokenRef = ref(storage, `${this.STORAGE_PATH}/users/${userId}/tokens.json`);

      // Delete from Firebase Storage
      const deletePromise = deleteObject(tokenRef);
      await this.withTimeout(deletePromise, this.STORAGE_TIMEOUT);

      console.log('✅ Tokens deleted from Firebase Storage successfully for user:', userId);
    } catch (error) {
      console.warn('⚠️ Error deleting tokens from Firebase Storage:', error);
      this.handleStorageError(error);
      // Don't throw - this is not critical
    }
  }

  // Check if tokens exist in Firebase Storage
  async hasTokens(userId: string): Promise<boolean> {
    try {
      if (!userId) {
        return false;
      }

      // Create Firebase Storage reference: DATA/users/{userId}/tokens.json
      const tokenRef = ref(storage, `${this.STORAGE_PATH}/users/${userId}/tokens.json`);

      // Try to get download URL - if it exists, the file exists
      await getDownloadURL(tokenRef);
      return true;
    } catch (error) {
      // File doesn't exist or other error
      console.log('ℹ️ No tokens found in Firebase Storage for user:', userId);
      return false;
    }
  }

  // Migrate tokens from localStorage to Firebase Storage (one-time migration)
  async migrateFromLocalStorage(userId: string): Promise<boolean> {
    if (!this.isStorageAvailable || !userId) {
      console.log('⚠️ Firebase Storage unavailable or no userId, skipping migration');
      return false;
    }

    try {
      // Check if tokens already exist in Firebase Storage
      const existingTokens = await this.getTokens(userId);
      if (existingTokens) {
        console.log('ℹ️ Tokens already exist in Firebase Storage, skipping migration');
        return true;
      }

      // Try to get tokens from localStorage
      const storedTokens = localStorage.getItem('google_business_tokens');
      const isConnected = localStorage.getItem('google_business_connected');

      if (storedTokens && isConnected === 'true') {
        try {
          const tokens = JSON.parse(storedTokens);

          // Convert localStorage format to our Firebase Storage format
          const storageTokens: StoredGoogleTokens = {
            access_token: tokens.access_token,
            token_type: tokens.token_type || 'Bearer',
            expires_in: tokens.expires_in || 3600,
            scope: tokens.scope || '',
            refresh_token: tokens.refresh_token,
            stored_at: Date.now(),
            expires_at: Date.now() + (tokens.expires_in || 3600) * 1000
          };

          await this.saveTokens(userId, storageTokens);
          console.log('✅ Successfully migrated tokens from localStorage to Firebase Storage');

          // Clear localStorage after successful migration
          localStorage.removeItem('google_business_tokens');
          localStorage.removeItem('google_business_connected');
          console.log('🧹 Cleared tokens from localStorage after migration');

          return true;
        } catch (parseError) {
          console.error('❌ Error parsing localStorage tokens for migration:', parseError);
          return false;
        }
      }

      console.log('ℹ️ No tokens found in localStorage to migrate');
      return false;
    } catch (error) {
      console.warn('⚠️ Error during token migration:', error);
      return false;
    }
  }

  // Helper method to add timeout to Firebase Storage operations
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Firebase Storage operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // Enhanced Firebase Storage error handling with retry logic
  private handleStorageError(error: any): void {
    const errorMessage = error?.message || 'Unknown error';

    // Categorize errors
    const isNetworkError = errorMessage.includes('offline') ||
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('transport errored') ||
                          errorMessage.includes('network error') ||
                          errorMessage.includes('Failed to fetch');

    const isQuotaError = errorMessage.includes('quota') ||
                        errorMessage.includes('rate') ||
                        errorMessage.includes('too many requests');

    const isPermissionError = errorMessage.includes('permission') ||
                             errorMessage.includes('unauthorized') ||
                             errorMessage.includes('forbidden');

    const isNotFoundError = errorMessage.includes('object does not exist') ||
                           errorMessage.includes('not found') ||
                           errorMessage.includes('404');

    if (isNetworkError) {
      console.log('⚠️ Firebase Storage network connectivity issues detected, temporarily disabling');
      this.isStorageAvailable = false;

      // Re-enable after 30 seconds for network issues
      setTimeout(() => {
        console.log('🔄 Re-enabling Firebase Storage after network issue resolution attempt');
        this.isStorageAvailable = true;
      }, 30000);
    } else if (isQuotaError) {
      console.log('⚠️ Firebase Storage quota/rate limit exceeded, temporarily disabling');
      this.isStorageAvailable = false;

      // Re-enable after 2 minutes for quota issues
      setTimeout(() => {
        console.log('🔄 Re-enabling Firebase Storage after quota cooldown');
        this.isStorageAvailable = true;
      }, 120000);
    } else if (isPermissionError) {
      console.error('❌ Firebase Storage permission error - this may require manual intervention:', errorMessage);
      // Don't disable for permission errors as they need manual fix
    } else if (isNotFoundError) {
      // File not found is normal for getTokens/hasTokens, don't log as error
      console.log('ℹ️ File not found in Firebase Storage (normal for first-time users)');
    } else {
      // For other errors, log but keep Firebase Storage available with brief cooldown
      console.log('⚠️ Firebase Storage error (keeping service available):', errorMessage);
      this.isStorageAvailable = false;

      // Short cooldown for unknown errors
      setTimeout(() => {
        this.isStorageAvailable = true;
      }, 10000);
    }
  }
}

// Export singleton instance
export const tokenStorageService = new TokenStorageService();
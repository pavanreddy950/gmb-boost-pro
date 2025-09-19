// Firebase Firestore token storage service for Google Business Profile tokens
import { doc, getDoc, setDoc, deleteDoc, enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from './firebase';

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
  private readonly COLLECTION_NAME = 'users';
  private readonly TOKEN_DOCUMENT = 'googleTokens';
  private isFirestoreAvailable = true; // Enabled for persistent token storage
  private readonly FIRESTORE_TIMEOUT = 10000; // 10 seconds timeout for better reliability

  // Save Google Business Profile tokens to Firestore
  async saveTokens(userId: string, tokens: StoredGoogleTokens, userInfo?: { id: string; email: string; name?: string; picture?: string }): Promise<void> {
    if (!this.isFirestoreAvailable || !userId) {
      console.log('⚠️ Firestore unavailable or no userId, skipping save');
      return;
    }

    try {
      const now = Date.now();
      const expiresAt = now + (tokens.expires_in * 1000);

      // Filter out undefined values for Firestore compatibility
      const cleanTokens = Object.fromEntries(
        Object.entries({
          ...tokens,
          stored_at: now,
          expires_at: expiresAt
        }).filter(([key, value]) => value !== undefined)
      );

      // Also filter undefined values from userInfo if it exists
      const cleanUserInfo = userInfo ? Object.fromEntries(
        Object.entries(userInfo).filter(([key, value]) => value !== undefined)
      ) : undefined;

      const tokenData: UserTokenData = {
        googleTokens: cleanTokens as StoredGoogleTokens,
        ...(cleanUserInfo && { userInfo: cleanUserInfo }),
        lastUpdated: now
      };

      const userDocRef = doc(db, this.COLLECTION_NAME, userId, 'tokens', this.TOKEN_DOCUMENT);
      
      // Add timeout to prevent hanging
      const savePromise = setDoc(userDocRef, tokenData);
      await this.withTimeout(savePromise, this.FIRESTORE_TIMEOUT);

      console.log('✅ Tokens saved to Firestore successfully for user:', userId);
    } catch (error) {
      console.warn('⚠️ Failed to save tokens to Firestore (non-critical):', error);
      this.handleFirestoreError(error);
      // Don't throw - let localStorage handle token storage as backup
    }
  }

  // Get Google Business Profile tokens from Firestore
  async getTokens(userId: string): Promise<StoredGoogleTokens | null> {
    if (!this.isFirestoreAvailable || !userId) {
      console.log('⚠️ Firestore unavailable or no userId, skipping retrieval');
      return null;
    }

    try {
      const userDocRef = doc(db, this.COLLECTION_NAME, userId, 'tokens', this.TOKEN_DOCUMENT);
      
      // Add timeout to prevent hanging
      const getPromise = getDoc(userDocRef);
      const docSnap = await this.withTimeout(getPromise, this.FIRESTORE_TIMEOUT);

      if (docSnap.exists()) {
        const data = docSnap.data() as UserTokenData;
        const tokens = data.googleTokens;

        // Check if tokens are expired
        const now = Date.now();
        if (tokens.expires_at && now >= tokens.expires_at) {
          console.log('⚠️ Tokens are expired, removing from Firestore');
          // Don't await this to avoid blocking
          this.deleteTokens(userId).catch(e => console.warn('Failed to delete expired tokens:', e));
          return null;
        }

        console.log('✅ Tokens retrieved from Firestore successfully for user:', userId);
        return tokens;
      } else {
        console.log('ℹ️ No tokens found in Firestore for user:', userId);
        return null;
      }
    } catch (error) {
      console.warn('⚠️ Error retrieving tokens from Firestore:', error);
      this.handleFirestoreError(error);
      return null;
    }
  }

  // Delete Google Business Profile tokens from Firestore
  async deleteTokens(userId: string): Promise<void> {
    if (!this.isFirestoreAvailable || !userId) {
      console.log('⚠️ Firestore unavailable or no userId, skipping delete');
      return;
    }

    try {
      const userDocRef = doc(db, this.COLLECTION_NAME, userId, 'tokens', this.TOKEN_DOCUMENT);
      
      // Add timeout to prevent hanging
      const deletePromise = deleteDoc(userDocRef);
      await this.withTimeout(deletePromise, this.FIRESTORE_TIMEOUT);

      console.log('✅ Tokens deleted from Firestore successfully for user:', userId);
    } catch (error) {
      console.warn('⚠️ Error deleting tokens from Firestore:', error);
      this.handleFirestoreError(error);
      // Don't throw - this is not critical
    }
  }

  // Check if tokens exist in Firestore
  async hasTokens(userId: string): Promise<boolean> {
    try {
      if (!userId) {
        return false;
      }

      const userDocRef = doc(db, this.COLLECTION_NAME, userId, 'tokens', this.TOKEN_DOCUMENT);
      const docSnap = await getDoc(userDocRef);
      
      return docSnap.exists();
    } catch (error) {
      console.error('❌ Error checking tokens existence in Firestore:', error);
      return false;
    }
  }

  // Migrate tokens from localStorage to Firestore (one-time migration)
  async migrateFromLocalStorage(userId: string): Promise<boolean> {
    if (!this.isFirestoreAvailable || !userId) {
      console.log('⚠️ Firestore unavailable or no userId, skipping migration');
      return false;
    }

    try {
      // Check if tokens already exist in Firestore
      const existingTokens = await this.getTokens(userId);
      if (existingTokens) {
        console.log('ℹ️ Tokens already exist in Firestore, skipping migration');
        return true;
      }

      // Try to get tokens from localStorage
      const storedTokens = localStorage.getItem('google_business_tokens');
      const isConnected = localStorage.getItem('google_business_connected');

      if (storedTokens && isConnected === 'true') {
        try {
          const tokens = JSON.parse(storedTokens);
          
          // Convert localStorage format to our Firestore format
          const firestoreTokens: StoredGoogleTokens = {
            access_token: tokens.access_token,
            token_type: tokens.token_type || 'Bearer',
            expires_in: tokens.expires_in || 3600,
            scope: tokens.scope || '',
            refresh_token: tokens.refresh_token,
            stored_at: Date.now(),
            expires_at: Date.now() + (tokens.expires_in || 3600) * 1000
          };

          await this.saveTokens(userId, firestoreTokens);
          console.log('✅ Successfully migrated tokens from localStorage to Firestore');
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

  // Helper method to add timeout to Firestore operations
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Firestore operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // Enhanced Firestore error handling with retry logic
  private handleFirestoreError(error: any): void {
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

    if (isNetworkError) {
      console.log('⚠️ Firestore network connectivity issues detected, temporarily disabling');
      this.isFirestoreAvailable = false;

      // Re-enable after 30 seconds for network issues
      setTimeout(() => {
        console.log('🔄 Re-enabling Firestore after network issue resolution attempt');
        this.isFirestoreAvailable = true;
      }, 30000);
    } else if (isQuotaError) {
      console.log('⚠️ Firestore quota/rate limit exceeded, temporarily disabling');
      this.isFirestoreAvailable = false;

      // Re-enable after 2 minutes for quota issues
      setTimeout(() => {
        console.log('🔄 Re-enabling Firestore after quota cooldown');
        this.isFirestoreAvailable = true;
      }, 120000);
    } else if (isPermissionError) {
      console.error('❌ Firestore permission error - this may require manual intervention:', errorMessage);
      // Don't disable for permission errors as they need manual fix
    } else {
      // For other errors, log but keep Firestore available with brief cooldown
      console.log('⚠️ Firestore error (keeping service available):', errorMessage);
      this.isFirestoreAvailable = false;

      // Short cooldown for unknown errors
      setTimeout(() => {
        this.isFirestoreAvailable = true;
      }, 10000);
    }
  }
}

// Export singleton instance
export const tokenStorageService = new TokenStorageService();
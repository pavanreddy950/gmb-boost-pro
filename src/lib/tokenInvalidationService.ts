/**
 * Token Invalidation Service
 *
 * Central service to coordinate global token invalidation and re-authentication across the app.
 * This service ensures all tokens are cleared from all storage layers (localStorage, backend)
 * and notifies all components that re-authentication is required.
 */

import { tokenStorageService } from './tokenStorage';

class TokenInvalidationService {
  private reauthListeners: Set<(reason: string) => void> = new Set();
  private isReauthRequired_flag: boolean = false;

  /**
   * Register a listener to be notified when re-authentication is required
   * @param callback Function to call when reauth is needed
   * @returns Cleanup function to unregister the listener
   */
  onReauthRequired(callback: (reason: string) => void): () => void {
    this.reauthListeners.add(callback);
    return () => this.reauthListeners.delete(callback);
  }

  /**
   * Invalidate all tokens and trigger re-authentication flow
   * This clears tokens from all storage layers and notifies all listeners
   * @param reason User-friendly message explaining why reauth is needed
   * @param userId Optional user ID for backend token cleanup
   */
  async invalidateAndRequestReauth(reason: string, userId?: string | null): Promise<void> {
    console.error('='.repeat(60));
    console.error('[TOKEN INVALIDATION] CRITICAL: Clearing all tokens');
    console.error('[TOKEN INVALIDATION] Reason:', reason);
    console.error('[TOKEN INVALIDATION] User ID:', userId || 'unknown');
    console.error('='.repeat(60));

    this.isReauthRequired_flag = true;

    // Clear all localStorage tokens
    const keysToRemove = [
      'google_business_tokens',
      'google_business_connected',
      'google_business_connection_time',
      'last_token_validation',
      'gbp_accounts_cache',
      'gbp_selected_account',
      'gbp_selected_location'
    ];

    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`[TOKEN INVALIDATION] ✅ Cleared localStorage: ${key}`);
      } catch (error) {
        console.warn(`[TOKEN INVALIDATION] ⚠️ Failed to clear localStorage ${key}:`, error);
      }
    });

    // Set flag to show reconnection banner
    localStorage.setItem('gbp_connection_issue', reason);

    // Clear Firebase Storage if userId available
    if (userId) {
      try {
        console.log('[TOKEN INVALIDATION] Clearing Firebase tokens...');
        await tokenStorageService.deleteTokens(userId);
        console.log('[TOKEN INVALIDATION] ✅ Cleared Firebase tokens');
      } catch (error) {
        console.warn('[TOKEN INVALIDATION] ⚠️ Failed to clear Firebase tokens:', error);
      }
    }

    // Notify all registered listeners
    console.log(`[TOKEN INVALIDATION] Notifying ${this.reauthListeners.size} listeners`);
    this.reauthListeners.forEach(listener => {
      try {
        listener(reason);
      } catch (error) {
        console.error('[TOKEN INVALIDATION] ⚠️ Listener error:', error);
      }
    });

    console.error('[TOKEN INVALIDATION] ✅ Token invalidation complete');
    console.error('='.repeat(60));
  }

  /**
   * Check if re-authentication is currently required
   * @returns true if tokens are invalid and reauth is needed
   */
  isReauthRequired(): boolean {
    // Check flag first
    if (this.isReauthRequired_flag) {
      return true;
    }

    // Check if connection issue flag is set
    const hasConnectionIssue = !!localStorage.getItem('gbp_connection_issue');

    // Check if tokens exist
    const hasTokens = !!localStorage.getItem('google_business_tokens');

    return hasConnectionIssue || !hasTokens;
  }

  /**
   * Clear the reauth state after successful reconnection
   * Call this after the user successfully completes OAuth flow
   */
  clearReauthState(): void {
    console.log('[TOKEN INVALIDATION] Clearing reauth state - user reconnected successfully');
    this.isReauthRequired_flag = false;
    localStorage.removeItem('gbp_connection_issue');
  }

  /**
   * Get the reason for re-authentication requirement
   * @returns Reason message or null if not required
   */
  getReauthReason(): string | null {
    return localStorage.getItem('gbp_connection_issue');
  }
}

// Export singleton instance
export const tokenInvalidationService = new TokenInvalidationService();

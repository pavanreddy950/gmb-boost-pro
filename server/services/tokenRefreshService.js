import cron from 'node-cron';
import tokenManager from './tokenManager.js';
import supabaseAutomationService from './supabaseAutomationService.js';

/**
 * Proactive Token Refresh Service
 *
 * Runs in background to keep all user tokens fresh BEFORE they expire.
 * This prevents 401 errors during automation runs.
 *
 * Strategy:
 * - Runs every 45 minutes (tokens expire in 60 minutes)
 * - Refreshes tokens that expire in next 15 minutes
 * - Tracks refresh success/failure
 * - Logs failures for monitoring
 */
class TokenRefreshService {
  constructor() {
    this.refreshJob = null;
    this.isRunning = false;
    this.lastRunTime = null;
    this.refreshStats = {
      totalRuns: 0,
      successfulRefreshes: 0,
      failedRefreshes: 0,
      usersProcessed: new Set()
    };
  }

  /**
   * Start the proactive token refresh service
   */
  start() {
    if (this.isRunning) {
      console.log('[TokenRefreshService] ⚠️ Service already running');
      return;
    }

    console.log('[TokenRefreshService] ========================================');
    console.log('[TokenRefreshService] 🚀 Starting Proactive Token Refresh Service');
    console.log('[TokenRefreshService] 📅 Schedule: Every 45 minutes');
    console.log('[TokenRefreshService] 🎯 Purpose: Keep tokens fresh for 24/7 automation');
    console.log('[TokenRefreshService] ========================================');

    // Schedule token refresh every 45 minutes
    // Tokens expire in 60 minutes, so this gives 15-minute buffer
    this.refreshJob = cron.schedule('*/45 * * * *', async () => {
      await this.runRefreshCycle();
    }, {
      scheduled: true,
      timezone: 'UTC' // Use UTC for consistency
    });

    this.isRunning = true;

    // Run immediately on startup to ensure fresh tokens
    console.log('[TokenRefreshService] 🔄 Running initial token refresh cycle...');
    setTimeout(() => {
      this.runRefreshCycle();
    }, 5000); // Wait 5 seconds for server to fully initialize

    console.log('[TokenRefreshService] ✅ Service started successfully');
  }

  /**
   * Stop the token refresh service
   */
  stop() {
    if (this.refreshJob) {
      this.refreshJob.stop();
      this.refreshJob = null;
      this.isRunning = false;
      console.log('[TokenRefreshService] 🛑 Service stopped');
    }
  }

  /**
   * Run a complete token refresh cycle for all automation users
   */
  async runRefreshCycle() {
    const startTime = Date.now();
    this.lastRunTime = new Date().toISOString();
    this.refreshStats.totalRuns++;

    console.log('[TokenRefreshService] ========================================');
    console.log('[TokenRefreshService] 🔄 STARTING TOKEN REFRESH CYCLE');
    console.log('[TokenRefreshService] 🕐 Time:', this.lastRunTime);
    console.log('[TokenRefreshService] 📊 Run #', this.refreshStats.totalRuns);
    console.log('[TokenRefreshService] ========================================');

    try {
      // Get all users with active automations
      const userIds = await this.getAllAutomationUserIds();

      if (userIds.length === 0) {
        console.log('[TokenRefreshService] ℹ️ No automation users found - skipping refresh cycle');
        console.log('[TokenRefreshService] ========================================');
        return;
      }

      console.log('[TokenRefreshService] 👥 Found ${userIds.length} user(s) with active automations:');
      userIds.forEach(userId => {
        console.log(`[TokenRefreshService]    - ${userId}`);
      });
      console.log('[TokenRefreshService] ');

      // Refresh tokens for each user
      let successCount = 0;
      let failCount = 0;

      for (const userId of userIds) {
        try {
          console.log(`[TokenRefreshService] 🔄 Processing tokens for user: ${userId}`);

          // This will automatically refresh if token expires in <15 minutes
          const token = await tokenManager.getValidTokens(userId);

          if (token && token.access_token) {
            successCount++;
            this.refreshStats.successfulRefreshes++;
            this.refreshStats.usersProcessed.add(userId);

            // Calculate time until expiry
            const expiresAt = new Date(token.expires_at);
            const minutesUntilExpiry = Math.round((expiresAt - Date.now()) / 1000 / 60);

            console.log(`[TokenRefreshService] ✅ Token valid for user ${userId} (expires in ${minutesUntilExpiry} minutes)`);
          } else {
            failCount++;
            this.refreshStats.failedRefreshes++;
            console.error(`[TokenRefreshService] ❌ Failed to get valid token for user ${userId}`);

            // Log failure
            this.logFailure(userId, 'No valid token returned from storage');
          }

          // Small delay between users to avoid rate limiting
          await this.sleep(1000);

        } catch (error) {
          failCount++;
          this.refreshStats.failedRefreshes++;
          console.error(`[TokenRefreshService] ❌ Error refreshing token for user ${userId}:`, error.message);

          // Log failure
          this.logFailure(userId, error.message);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('[TokenRefreshService] ========================================');
      console.log('[TokenRefreshService] ✅ REFRESH CYCLE COMPLETE');
      console.log(`[TokenRefreshService] 📊 Results: ${successCount} success, ${failCount} failed`);
      console.log(`[TokenRefreshService] ⏱️ Duration: ${duration} seconds`);
      console.log('[TokenRefreshService] 📅 Next run: In 45 minutes');
      console.log('[TokenRefreshService] ========================================');

    } catch (error) {
      console.error('[TokenRefreshService] ❌ Fatal error during refresh cycle:', error);
      console.error('[TokenRefreshService] Stack:', error.stack);
      console.log('[TokenRefreshService] ========================================');
    }
  }

  /**
   * Get all unique user IDs from automation settings (Supabase)
   */
  async getAllAutomationUserIds() {
    try {
      // Get all enabled automations from Supabase
      const automations = await supabaseAutomationService.getAllEnabledAutomations();

      if (!automations || automations.length === 0) {
        console.log('[TokenRefreshService] ⚠️ No enabled automations found');
        return [];
      }

      const userIds = new Set();

      // Extract unique user IDs from all automations
      for (const automation of automations) {
        if (automation.userId) {
          userIds.add(automation.userId);
        }
      }

      // Filter out 'default' as it's not a real user ID
      const validUserIds = Array.from(userIds).filter(id => id && id !== 'default');

      return validUserIds;

    } catch (error) {
      console.error('[TokenRefreshService] ❌ Error reading automation settings from Supabase:', error);
      return [];
    }
  }

  /**
   * Log token refresh failure (to Supabase)
   */
  async logFailure(userId, errorMessage) {
    try {
      // Log to Supabase token_failures table via tokenStorage
      const supabaseTokenStorage = (await import('./supabaseTokenStorage.js')).default;
      await supabaseTokenStorage.logTokenFailure(userId, 'refresh_service_error', errorMessage);
    } catch (error) {
      console.error('[TokenRefreshService] ❌ Error logging failure to Supabase:', error);
    }
  }

  /**
   * Get service statistics
   */
  async getStats() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      totalRuns: this.refreshStats.totalRuns,
      successfulRefreshes: this.refreshStats.successfulRefreshes,
      failedRefreshes: this.refreshStats.failedRefreshes,
      uniqueUsersProcessed: this.refreshStats.usersProcessed.size,
      currentAutomationUsers: await this.getAllAutomationUserIds()
    };
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const tokenRefreshService = new TokenRefreshService();

export default tokenRefreshService;

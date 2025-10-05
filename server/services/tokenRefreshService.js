import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import firestoreTokenStorage from './firestoreTokenStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    this.failureLogPath = path.join(__dirname, '..', 'data', 'token_failures.json');
    this.automationSettingsPath = path.join(__dirname, '..', 'data', 'automationSettings.json');
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
      const userIds = this.getAllAutomationUserIds();

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
          const token = await firestoreTokenStorage.getValidToken(userId);

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
   * Get all unique user IDs from automation settings
   */
  getAllAutomationUserIds() {
    try {
      if (!fs.existsSync(this.automationSettingsPath)) {
        console.log('[TokenRefreshService] ⚠️ Automation settings file not found');
        return [];
      }

      const data = fs.readFileSync(this.automationSettingsPath, 'utf8');
      const settings = JSON.parse(data);
      const automations = settings.automations || {};

      const userIds = new Set();

      // Extract unique user IDs from all automations
      for (const [locationId, config] of Object.entries(automations)) {
        // Check top-level userId
        if (config.userId) {
          userIds.add(config.userId);
        }

        // Check autoPosting userId
        if (config.autoPosting?.userId) {
          userIds.add(config.autoPosting.userId);
        }

        // Check autoReply userId
        if (config.autoReply?.userId) {
          userIds.add(config.autoReply.userId);
        }
      }

      // Filter out 'default' as it's not a real user ID
      const validUserIds = Array.from(userIds).filter(id => id && id !== 'default');

      return validUserIds;

    } catch (error) {
      console.error('[TokenRefreshService] ❌ Error reading automation settings:', error);
      return [];
    }
  }

  /**
   * Log token refresh failure
   */
  logFailure(userId, errorMessage) {
    try {
      let failures = [];

      // Load existing failures
      if (fs.existsSync(this.failureLogPath)) {
        const data = fs.readFileSync(this.failureLogPath, 'utf8');
        failures = JSON.parse(data);
      }

      // Add new failure
      failures.push({
        userId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        service: 'TokenRefreshService'
      });

      // Keep only last 100 failures
      if (failures.length > 100) {
        failures = failures.slice(-100);
      }

      // Save to file
      fs.writeFileSync(this.failureLogPath, JSON.stringify(failures, null, 2));

    } catch (error) {
      console.error('[TokenRefreshService] ❌ Error logging failure:', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      totalRuns: this.refreshStats.totalRuns,
      successfulRefreshes: this.refreshStats.successfulRefreshes,
      failedRefreshes: this.refreshStats.failedRefreshes,
      uniqueUsersProcessed: this.refreshStats.usersProcessed.size,
      currentAutomationUsers: this.getAllAutomationUserIds()
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

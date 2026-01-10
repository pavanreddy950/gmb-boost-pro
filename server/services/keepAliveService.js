import fetch from 'node-fetch';
import config from '../config.js';

/**
 * Keep-Alive Service (Render Edition)
 *
 * This service prevents Render from spinning down the server by:
 * 1. Self-pinging every 4 minutes to keep the server awake
 * 2. Periodically checking if automations are still running
 * 3. Auto-reinitializing automations if they stopped
 *
 * WHY THIS IS NEEDED:
 * - Render Free tier spins down after 15 minutes of inactivity
 * - When the server spins down, all cron jobs and automation schedulers STOP
 * - This causes scheduled posts to only run when users visit the site
 * - This service keeps the server alive 24/7 to ensure automation works
 *
 * RENDER-SPECIFIC:
 * - Render uses RENDER_EXTERNAL_URL environment variable for the app URL
 * - Free tier has 750 hours/month limit, Starter tier has no spin-down
 * - Consider upgrading to Starter ($7/mo) for true 24/7 operation
 * - Alternative: Use UptimeRobot (free) to ping every 5 minutes from outside
 */
class KeepAliveService {
  constructor() {
    this.interval = null;
    this.automationCheckInterval = null;
    this.pingIntervalMs = 4 * 60 * 1000; // 4 minutes (under Render's 15-minute timeout)
    this.automationCheckIntervalMs = 10 * 60 * 1000; // Check automations every 10 minutes
    this.healthCheckEndpoint = null;
    this.isRunning = false;
    this.stats = {
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      lastPingTime: null,
      lastPingStatus: null,
      startTime: null,
      automationChecks: 0,
      automationReinitializations: 0,
      lastAutomationCheck: null
    };

    console.log('[KeepAliveService] 🏥 Service initialized (RENDER MODE)');
  }

  /**
   * Start the keep-alive service
   */
  start() {
    if (this.isRunning) {
      console.log('[KeepAliveService] ⚠️  Service is already running');
      return;
    }

    // Determine the health check endpoint based on environment
    this.healthCheckEndpoint = this.getHealthCheckEndpoint();

    if (!this.healthCheckEndpoint) {
      console.log('[KeepAliveService] ⚠️  No health check endpoint configured');
      console.log('[KeepAliveService] Using fallback: http://localhost:5000/health');
      this.healthCheckEndpoint = 'http://localhost:5000/health';
    }

    console.log('[KeepAliveService] 🚀 Starting keep-alive service for RENDER...');
    console.log(`[KeepAliveService] 📍 Health check endpoint: ${this.healthCheckEndpoint}`);
    console.log(`[KeepAliveService] ⏰ Ping interval: ${this.pingIntervalMs / 1000} seconds`);
    console.log(`[KeepAliveService] 🔄 Automation check interval: ${this.automationCheckIntervalMs / 1000} seconds`);

    this.isRunning = true;
    this.stats.startTime = new Date();

    // Ping immediately on startup
    this.ping();

    // Then ping every 4 minutes to prevent Render spin-down
    this.interval = setInterval(() => {
      this.ping();
    }, this.pingIntervalMs);

    // Also periodically check if automations are still running
    this.automationCheckInterval = setInterval(() => {
      this.checkAndRestartAutomations();
    }, this.automationCheckIntervalMs);

    console.log('[KeepAliveService] ✅ Keep-alive service started! Server will stay awake 24/7');
    console.log('[KeepAliveService] 💡 TIP: For guaranteed 24/7 operation on Render, upgrade to Starter tier ($7/mo)');
    console.log('[KeepAliveService] 💡 TIP: Or use UptimeRobot (free) to ping your server every 5 minutes');
  }

  /**
   * Stop the keep-alive service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.automationCheckInterval) {
      clearInterval(this.automationCheckInterval);
      this.automationCheckInterval = null;
    }
    this.isRunning = false;
    console.log('[KeepAliveService] 🛑 Keep-alive service stopped');
  }

  /**
   * Perform a health check ping
   */
  async ping() {
    const pingTime = new Date();

    try {
      console.log(`[KeepAliveService] 🏓 Pinging health check at ${pingTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST...`);

      const response = await fetch(this.healthCheckEndpoint, {
        method: 'GET',
        timeout: 15000, // 15 second timeout
        headers: {
          'User-Agent': 'KeepAliveService/2.0-Render',
          'X-Keep-Alive': 'true'
        }
      });

      if (response.ok) {
        this.stats.totalPings++;
        this.stats.successfulPings++;
        this.stats.lastPingTime = pingTime;
        this.stats.lastPingStatus = 'success';

        console.log(`[KeepAliveService] ✅ Ping successful (${response.status}) - Server is alive!`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.stats.totalPings++;
      this.stats.failedPings++;
      this.stats.lastPingTime = pingTime;
      this.stats.lastPingStatus = 'failed';

      console.error(`[KeepAliveService] ❌ Ping failed:`, error.message);

      // If ping fails, server might have restarted - trigger automation check
      console.log(`[KeepAliveService] 🔄 Triggering automation check due to ping failure...`);
      setTimeout(() => this.checkAndRestartAutomations(), 5000);
    }
  }

  /**
   * Check if automations are running and restart if needed
   * This is critical for Render where the server may have restarted
   */
  async checkAndRestartAutomations() {
    try {
      this.stats.automationChecks++;
      this.stats.lastAutomationCheck = new Date();

      console.log(`[KeepAliveService] 🔍 Checking automation status (check #${this.stats.automationChecks})...`);

      // Import automationScheduler dynamically to avoid circular dependency
      const { default: automationScheduler } = await import('./automationScheduler.js');

      const scheduledJobs = automationScheduler.scheduledJobs?.size || 0;
      const settingsCount = Object.keys(automationScheduler.settings?.automations || {}).length;

      console.log(`[KeepAliveService] 📊 Automation status: ${scheduledJobs} jobs scheduled, ${settingsCount} settings loaded`);

      // If no jobs are scheduled but we have settings, reinitialize
      if (scheduledJobs === 0 && settingsCount > 0) {
        console.log(`[KeepAliveService] ⚠️ Jobs stopped but settings exist - automations may have crashed`);
        console.log(`[KeepAliveService] 🔄 Reinitializing automations...`);

        this.stats.automationReinitializations++;
        await automationScheduler.initializeAutomations();

        const newJobCount = automationScheduler.scheduledJobs?.size || 0;
        console.log(`[KeepAliveService] ✅ Reinitialized! Now ${newJobCount} jobs scheduled`);
      } else if (scheduledJobs === 0 && settingsCount === 0) {
        // No settings loaded - try to reload from database
        console.log(`[KeepAliveService] ⚠️ No settings loaded - attempting to load from database...`);

        this.stats.automationReinitializations++;
        await automationScheduler.initializeAutomations();

        const newJobCount = automationScheduler.scheduledJobs?.size || 0;
        const newSettingsCount = Object.keys(automationScheduler.settings?.automations || {}).length;
        console.log(`[KeepAliveService] ✅ Loaded ${newSettingsCount} settings, ${newJobCount} jobs scheduled`);
      } else {
        console.log(`[KeepAliveService] ✅ Automations are running normally`);
      }

    } catch (error) {
      console.error(`[KeepAliveService] ❌ Error checking automations:`, error.message);
    }
  }

  /**
   * Get the health check endpoint based on environment
   */
  getHealthCheckEndpoint() {
    let backendUrl = null;

    // Check for Render environment first
    if (process.env.RENDER_EXTERNAL_URL) {
      backendUrl = process.env.RENDER_EXTERNAL_URL;
      console.log(`[KeepAliveService] 🎯 Detected Render deployment: ${backendUrl}`);
    }
    // Check for RENDER environment variable (alternative)
    else if (process.env.RENDER) {
      // On Render, construct URL from service name
      const serviceName = process.env.RENDER_SERVICE_NAME || 'server';
      backendUrl = `https://${serviceName}.onrender.com`;
      console.log(`[KeepAliveService] 🎯 Detected Render (constructed): ${backendUrl}`);
    }
    // Check for explicit BACKEND_URL
    else if (process.env.BACKEND_URL) {
      backendUrl = process.env.BACKEND_URL;
      console.log(`[KeepAliveService] 🎯 Using BACKEND_URL: ${backendUrl}`);
    }
    // Fallback for Azure (legacy)
    else if (config.isAzure || process.env.WEBSITE_HOSTNAME) {
      backendUrl = process.env.WEBSITE_HOSTNAME
        ? `https://${process.env.WEBSITE_HOSTNAME}`
        : config.backendUrl;
      console.log(`[KeepAliveService] 🎯 Detected Azure: ${backendUrl}`);
    }
    // Local development
    else {
      backendUrl = config.backendUrl || `http://localhost:${config.port || 5000}`;
      console.log(`[KeepAliveService] 🎯 Using local/default: ${backendUrl}`);
    }

    // Ensure URL doesn't end with slash
    backendUrl = backendUrl.replace(/\/$/, '');

    return `${backendUrl}/health`;
  }

  /**
   * Get service statistics
   */
  getStats() {
    const uptime = this.stats.startTime
      ? Math.floor((new Date() - this.stats.startTime) / 1000)
      : 0;

    const successRate = this.stats.totalPings > 0
      ? ((this.stats.successfulPings / this.stats.totalPings) * 100).toFixed(2)
      : 0;

    return {
      isRunning: this.isRunning,
      platform: process.env.RENDER ? 'Render' : (config.isAzure ? 'Azure' : 'Other'),
      endpoint: this.healthCheckEndpoint,
      pingInterval: `${this.pingIntervalMs / 1000} seconds`,
      uptime: `${uptime} seconds`,
      uptimeFormatted: this.formatUptime(uptime),
      totalPings: this.stats.totalPings,
      successfulPings: this.stats.successfulPings,
      failedPings: this.stats.failedPings,
      successRate: `${successRate}%`,
      lastPingTime: this.stats.lastPingTime?.toISOString() || 'Never',
      lastPingStatus: this.stats.lastPingStatus || 'N/A',
      automationChecks: this.stats.automationChecks,
      automationReinitializations: this.stats.automationReinitializations,
      lastAutomationCheck: this.stats.lastAutomationCheck?.toISOString() || 'Never',
      nextPingIn: this.isRunning && this.stats.lastPingTime
        ? `${Math.max(0, Math.floor((this.pingIntervalMs - (new Date() - this.stats.lastPingTime)) / 1000))} seconds`
        : 'N/A'
    };
  }

  /**
   * Format uptime in human-readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }
}

// Export singleton instance
const keepAliveService = new KeepAliveService();
export default keepAliveService;

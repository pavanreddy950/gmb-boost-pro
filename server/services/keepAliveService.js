import fetch from 'node-fetch';
import config from '../config.js';

/**
 * Keep-Alive Service
 *
 * This service prevents Azure App Service from going to sleep by:
 * 1. Self-pinging every 5 minutes to keep the server awake
 * 2. Making health check requests to maintain activity
 * 3. Logging activity to help with debugging
 *
 * WHY THIS IS NEEDED:
 * - Azure App Service (Basic/Free tiers) goes to sleep after 20 minutes of inactivity
 * - When the server sleeps, all cron jobs and automation schedulers STOP
 * - This causes scheduled posts to only run when users log in
 * - This service keeps the server alive 24/7 to ensure automation works
 *
 * ALTERNATIVE SOLUTIONS:
 * - Enable "Always On" in Azure App Service (requires Basic tier or higher)
 * - Use Azure Functions with timer triggers (more complex)
 * - Use external monitoring service like UptimeRobot (free, recommended as backup)
 */
class KeepAliveService {
  constructor() {
    this.interval = null;
    this.pingIntervalMs = 5 * 60 * 1000; // 5 minutes (well under Azure's 20-minute timeout)
    this.healthCheckEndpoint = null;
    this.isRunning = false;
    this.stats = {
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      lastPingTime: null,
      lastPingStatus: null,
      startTime: null
    };

    console.log('[KeepAliveService] 🏥 Service initialized');
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

    console.log('[KeepAliveService] 🚀 Starting keep-alive service...');
    console.log(`[KeepAliveService] 📍 Health check endpoint: ${this.healthCheckEndpoint}`);
    console.log(`[KeepAliveService] ⏰ Ping interval: ${this.pingIntervalMs / 1000} seconds`);

    this.isRunning = true;
    this.stats.startTime = new Date();

    // Ping immediately on startup
    this.ping();

    // Then ping every 5 minutes
    this.interval = setInterval(() => {
      this.ping();
    }, this.pingIntervalMs);

    console.log('[KeepAliveService] ✅ Keep-alive service started! Server will stay awake 24/7');
  }

  /**
   * Stop the keep-alive service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      console.log('[KeepAliveService] 🛑 Keep-alive service stopped');
    }
  }

  /**
   * Perform a health check ping
   */
  async ping() {
    const pingTime = new Date();

    try {
      console.log(`[KeepAliveService] 🏓 Pinging health check endpoint at ${pingTime.toISOString()}...`);

      const response = await fetch(this.healthCheckEndpoint, {
        method: 'GET',
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'KeepAliveService/1.0',
          'X-Keep-Alive': 'true'
        }
      });

      if (response.ok) {
        this.stats.totalPings++;
        this.stats.successfulPings++;
        this.stats.lastPingTime = pingTime;
        this.stats.lastPingStatus = 'success';

        console.log(`[KeepAliveService] ✅ Ping successful (${response.status}) - Server is alive!`);
        console.log(`[KeepAliveService] 📊 Stats: ${this.stats.successfulPings}/${this.stats.totalPings} successful pings`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.stats.totalPings++;
      this.stats.failedPings++;
      this.stats.lastPingTime = pingTime;
      this.stats.lastPingStatus = 'failed';

      console.error(`[KeepAliveService] ❌ Ping failed:`, error.message);
      console.error(`[KeepAliveService] 📊 Stats: ${this.stats.failedPings} failed pings out of ${this.stats.totalPings} total`);
    }
  }

  /**
   * Get the health check endpoint based on environment
   */
  getHealthCheckEndpoint() {
    // Try to determine backend URL from environment
    let backendUrl = null;

    // Check if we're running on Azure
    if (config.isAzure) {
      // Azure App Service - use the Azure URL
      backendUrl = process.env.BACKEND_URL || process.env.WEBSITE_HOSTNAME
        ? `https://${process.env.WEBSITE_HOSTNAME}`
        : null;

      // If still not found, try to detect from common Azure patterns
      if (!backendUrl && process.env.WEBSITE_SITE_NAME) {
        backendUrl = `https://${process.env.WEBSITE_SITE_NAME}.azurewebsites.net`;
      }

      // Final fallback for Azure
      if (!backendUrl) {
        backendUrl = 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
      }
    } else {
      // Local development or other environments
      backendUrl = config.backendUrl || process.env.BACKEND_URL || `http://localhost:${config.port || 5000}`;
    }

    // Ensure URL doesn't end with slash
    backendUrl = backendUrl.replace(/\/$/, '');

    console.log(`[KeepAliveService] 📍 Detected backend URL: ${backendUrl}`);
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
      endpoint: this.healthCheckEndpoint,
      pingInterval: `${this.pingIntervalMs / 1000} seconds`,
      uptime: `${uptime} seconds`,
      totalPings: this.stats.totalPings,
      successfulPings: this.stats.successfulPings,
      failedPings: this.stats.failedPings,
      successRate: `${successRate}%`,
      lastPingTime: this.stats.lastPingTime?.toISOString() || 'Never',
      lastPingStatus: this.stats.lastPingStatus || 'N/A',
      nextPingIn: this.isRunning && this.stats.lastPingTime
        ? `${Math.max(0, Math.floor((this.pingIntervalMs - (new Date() - this.stats.lastPingTime)) / 1000))} seconds`
        : 'N/A'
    };
  }
}

// Export singleton instance
const keepAliveService = new KeepAliveService();
export default keepAliveService;

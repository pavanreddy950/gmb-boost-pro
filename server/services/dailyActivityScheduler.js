import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dailyActivityEmailService from './dailyActivityEmailService.js';
import supabaseTokenStorage from './supabaseTokenStorage.js';
import supabaseSubscriptionService from './supabaseSubscriptionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DailyActivityScheduler {
  constructor() {
    this.activityLogPath = path.join(__dirname, '../data/daily_activity_log.json');
    this.scheduledJobs = [];

    console.log('[DailyActivityScheduler] Initializing...');
  }

  /**
   * Load subscriptions data from Supabase
   */
  async loadSubscriptions() {
    try {
      const subscriptions = await supabaseSubscriptionService.getAllSubscriptions();
      console.log(`[DailyActivityScheduler] ✅ Loaded ${subscriptions.length} subscriptions from Supabase`);
      return subscriptions || [];
    } catch (error) {
      console.error('[DailyActivityScheduler] ❌ Error loading subscriptions from Supabase:', error);
      return [];
    }
  }

  /**
   * Load or initialize daily activity log
   */
  async loadActivityLog() {
    try {
      const data = await fs.readFile(this.activityLogPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist, return empty log
      return { activities: {} };
    }
  }

  /**
   * Save activity log
   */
  async saveActivityLog(log) {
    try {
      await fs.writeFile(this.activityLogPath, JSON.stringify(log, null, 2), 'utf8');
    } catch (error) {
      console.error('[DailyActivityScheduler] Error saving activity log:', error);
    }
  }

  /**
   * Log post creation activity
   */
  async logPostActivity(userId, locationName, locationId, postData) {
    const log = await this.loadActivityLog();
    const today = new Date().toISOString().split('T')[0];

    if (!log.activities[userId]) {
      log.activities[userId] = {};
    }

    if (!log.activities[userId][today]) {
      log.activities[userId][today] = {
        postsCreated: [],
        reviewsReplied: []
      };
    }

    log.activities[userId][today].postsCreated.push({
      locationName,
      locationId,
      title: postData.summary || 'New Post',
      summary: postData.summary,
      createdAt: new Date().toISOString()
    });

    await this.saveActivityLog(log);
    console.log(`[DailyActivityScheduler] Logged post activity for user ${userId}`);
  }

  /**
   * Log review reply activity
   */
  async logReviewActivity(userId, locationName, locationId, reviewData) {
    const log = await this.loadActivityLog();
    const today = new Date().toISOString().split('T')[0];

    if (!log.activities[userId]) {
      log.activities[userId] = {};
    }

    if (!log.activities[userId][today]) {
      log.activities[userId][today] = {
        postsCreated: [],
        reviewsReplied: []
      };
    }

    log.activities[userId][today].reviewsReplied.push({
      locationName,
      locationId,
      reviewer: reviewData.reviewer?.displayName || 'Customer',
      starRating: reviewData.starRating || 5,
      comment: reviewData.comment || '',
      reply: reviewData.reviewReply?.comment || '',
      createdAt: new Date().toISOString()
    });

    await this.saveActivityLog(log);
    console.log(`[DailyActivityScheduler] Logged review activity for user ${userId}`);
  }

  /**
   * Get today's activity for a user
   */
  async getTodayActivity(userId) {
    const log = await this.loadActivityLog();
    const today = new Date().toISOString().split('T')[0];

    return log.activities[userId]?.[today] || {
      postsCreated: [],
      reviewsReplied: []
    };
  }

  /**
   * Fetch user locations
   */
  async getUserLocations(userId) {
    try {
      const validToken = await supabaseTokenStorage.getValidToken(userId);

      if (!validToken) {
        return [];
      }

      // Fetch accounts
      const accountsResponse = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        {
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!accountsResponse.ok) {
        return [];
      }

      const accountsData = await accountsResponse.json();
      const accounts = accountsData.accounts || [];

      const allLocations = [];

      // Fetch locations for each account
      for (const account of accounts) {
        try {
          const locationsResponse = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
            {
              headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (locationsResponse.ok) {
            const locationsData = await locationsResponse.json();
            if (locationsData.locations) {
              allLocations.push(...locationsData.locations.map(loc => ({
                name: loc.name,
                title: loc.title || loc.locationName,
                address: loc.storefrontAddress?.formattedAddress || 'N/A'
              })));
            }
          }
        } catch (error) {
          console.error(`[DailyActivityScheduler] Error fetching locations for account ${account.name}:`, error);
        }
      }

      return allLocations;
    } catch (error) {
      console.error(`[DailyActivityScheduler] Error fetching locations for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Calculate trial days remaining
   */
  calculateTrialDaysRemaining(subscription) {
    if (subscription.status !== 'trial' || !subscription.trialEndDate) {
      return 0;
    }

    const now = new Date();
    const trialEnd = new Date(subscription.trialEndDate);
    const diff = trialEnd - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return days > 0 ? days : 0;
  }

  /**
   * Determine if user should receive daily report
   */
  shouldSendDailyReport(subscription) {
    const status = subscription.status;
    const trialDaysRemaining = this.calculateTrialDaysRemaining(subscription);

    // During trial: send daily
    if (status === 'trial' && trialDaysRemaining > 0) {
      return { send: true, frequency: 'daily' };
    }

    // After trial ends: send weekly (every 7 days)
    if (status === 'active' || status === 'expired') {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Send on Sundays (day 0)
      return { send: dayOfWeek === 0, frequency: 'weekly' };
    }

    return { send: false, frequency: 'none' };
  }

  /**
   * Send daily report to a single user
   */
  async sendUserDailyReport(subscription) {
    try {
      const { userId, email, status } = subscription;

      console.log(`[DailyActivityScheduler] Processing report for ${email}`);

      // Check if we should send report
      const { send, frequency } = this.shouldSendDailyReport(subscription);

      if (!send) {
        console.log(`[DailyActivityScheduler] Skipping ${email} - ${frequency} schedule not met`);
        return { success: false, reason: 'Schedule not met' };
      }

      // Get today's activity
      const todayActivity = await this.getTodayActivity(userId);

      // Get user locations
      const locations = await this.getUserLocations(userId);

      // Prepare user data
      const userData = {
        userName: email.split('@')[0],
        userEmail: email,
        isTrialUser: status === 'trial',
        trialDaysRemaining: this.calculateTrialDaysRemaining(subscription)
      };

      // Prepare activity data
      const activityData = {
        postsCreated: todayActivity.postsCreated || [],
        reviewsReplied: todayActivity.reviewsReplied || [],
        locations: locations
      };

      // Prepare audit data (basic stats)
      const auditData = {
        totalLocations: locations.length,
        avgCompletion: 85,
        totalReviews: todayActivity.reviewsReplied.length,
        avgRating: 4.5
      };

      // Send email
      const result = await dailyActivityEmailService.sendDailyReport(
        email,
        userData,
        activityData,
        auditData
      );

      if (result.success) {
        console.log(`[DailyActivityScheduler] ✅ Daily report sent to ${email}`);
      } else {
        console.error(`[DailyActivityScheduler] ❌ Failed to send daily report to ${email}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error('[DailyActivityScheduler] Error sending user daily report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send daily reports to all users
   */
  async sendAllDailyReports() {
    try {
      console.log('[DailyActivityScheduler] 📧 Starting daily report batch send...');

      const subscriptions = await this.loadSubscriptions();
      console.log(`[DailyActivityScheduler] Found ${subscriptions.length} subscriptions`);

      const results = [];

      for (const subscription of subscriptions) {
        try {
          const result = await this.sendUserDailyReport(subscription);
          results.push({
            email: subscription.email,
            ...result
          });

          // Rate limiting - wait 500ms between emails
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[DailyActivityScheduler] Error processing ${subscription.email}:`, error);
          results.push({
            email: subscription.email,
            success: false,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      console.log(`[DailyActivityScheduler] ✅ Batch complete: ${successful}/${results.length} emails sent`);

      return results;
    } catch (error) {
      console.error('[DailyActivityScheduler] Error in batch send:', error);
      return [];
    }
  }

  /**
   * Initialize daily report scheduler
   * Runs every day at 6 PM (18:00)
   */
  initializeDailyReportScheduler() {
    // Schedule for 6 PM daily (18:00 in 24-hour format)
    const cronExpression = '0 18 * * *';

    const job = cron.schedule(cronExpression, async () => {
      console.log('[DailyActivityScheduler] ⏰ Daily report schedule triggered at 6 PM');
      await this.sendAllDailyReports();
    });

    this.scheduledJobs.push(job);

    console.log('[DailyActivityScheduler] ✅ Daily report scheduler initialized (6 PM daily)');
    console.log('[DailyActivityScheduler] Schedule: Daily at 6:00 PM for trial users, Weekly on Sundays for active users');
  }

  /**
   * Start all schedulers
   */
  async start() {
    console.log('[DailyActivityScheduler] 🚀 Starting daily activity scheduler...');

    this.initializeDailyReportScheduler();

    console.log('[DailyActivityScheduler] ✅ All schedulers started successfully');

    // Run initial check (optional - comment out if you don't want immediate execution)
    // console.log('[DailyActivityScheduler] Running initial daily report check...');
    // await this.sendAllDailyReports();
  }

  /**
   * Stop all schedulers
   */
  stop() {
    console.log('[DailyActivityScheduler] Stopping all schedulers...');

    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];

    console.log('[DailyActivityScheduler] All schedulers stopped');
  }
}

export default new DailyActivityScheduler();

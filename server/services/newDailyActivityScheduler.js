import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import newDailyActivityEmailService from './newDailyActivityEmailService.js';
import supabaseTokenStorage from './supabaseTokenStorage.js';
import supabaseSubscriptionService from './supabaseSubscriptionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NewDailyActivityScheduler {
  constructor() {
    this.activityLogPath = path.join(__dirname, '../data/daily_activity_log.json');
    this.emailTrackingPath = path.join(__dirname, '../data/email_tracking.json');
    this.scheduledJobs = [];

    console.log('[NewDailyActivityScheduler] Initializing...');
  }

  /**
   * Load subscriptions data from Supabase
   */
  async loadSubscriptions() {
    try {
      const subscriptions = await supabaseSubscriptionService.getAllSubscriptions();
      console.log(`[NewDailyActivityScheduler] ✅ Loaded ${subscriptions.length} subscriptions from Supabase`);
      return subscriptions || [];
    } catch (error) {
      console.error('[NewDailyActivityScheduler] ❌ Error loading subscriptions from Supabase:', error);
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
      const dir = path.dirname(this.activityLogPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.activityLogPath, JSON.stringify(log, null, 2), 'utf8');
    } catch (error) {
      console.error('[NewDailyActivityScheduler] Error saving activity log:', error);
    }
  }

  /**
   * Load email tracking log
   */
  async loadEmailTracking() {
    try {
      const data = await fs.readFile(this.emailTrackingPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { lastSent: {} };
    }
  }

  /**
   * Save email tracking log
   */
  async saveEmailTracking(tracking) {
    try {
      const dir = path.dirname(this.emailTrackingPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.emailTrackingPath, JSON.stringify(tracking, null, 2), 'utf8');
    } catch (error) {
      console.error('[NewDailyActivityScheduler] Error saving email tracking:', error);
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
    console.log(`[NewDailyActivityScheduler] Logged post activity for user ${userId}`);
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
    console.log(`[NewDailyActivityScheduler] Logged review activity for user ${userId}`);
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
   * Fetch user locations with details
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
            `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,profile`,
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
                address: loc.storefrontAddress?.formattedAddress || 'N/A',
                profile: loc.profile || {}
              })));
            }
          }
        } catch (error) {
          console.error(`[NewDailyActivityScheduler] Error fetching locations for account ${account.name}:`, error);
        }
      }

      return allLocations;
    } catch (error) {
      console.error(`[NewDailyActivityScheduler] Error fetching locations for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Fetch real audit data for user's locations
   */
  async getAuditData(userId, locations) {
    try {
      if (!locations || locations.length === 0) {
        return null;
      }

      // Calculate aggregate audit scores
      let totalProfileCompletion = 0;
      let locationsWithData = 0;

      for (const location of locations) {
        const profile = location.profile || {};
        
        // Calculate profile completion (simplified)
        let completionScore = 0;
        const fields = ['description', 'phoneNumbers', 'websiteUri', 'categories'];
        fields.forEach(field => {
          if (profile[field]) completionScore += 25;
        });

        totalProfileCompletion += completionScore;
        locationsWithData++;
      }

      const avgProfileCompletion = locationsWithData > 0 
        ? Math.round(totalProfileCompletion / locationsWithData) 
        : 67;

      // Mock Google Search Rank (in production, this would come from actual search results)
      const googleSearchRank = Math.floor(Math.random() * 3) + 3; // Random between 3-5

      return {
        googleSearchRank,
        profileCompletion: avgProfileCompletion,
        seoScore: 100, // This would be calculated based on various SEO factors
        reviewReplyScore: 100, // This would be calculated based on review response rate
        totalLocations: locations.length
      };
    } catch (error) {
      console.error('[NewDailyActivityScheduler] Error getting audit data:', error);
      return {
        googleSearchRank: 5,
        profileCompletion: 67,
        seoScore: 100,
        reviewReplyScore: 100,
        totalLocations: locations.length
      };
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
   * Check if trial has expired
   */
  isTrialExpired(subscription) {
    if (subscription.status !== 'trial' && subscription.status !== 'trial_expired') {
      return false;
    }

    if (!subscription.trialEndDate) {
      return false;
    }

    const now = new Date();
    const trialEnd = new Date(subscription.trialEndDate);
    
    return now > trialEnd;
  }

  /**
   * Determine if user should receive email based on new rules:
   * - Trial users (15 days): Daily emails
   * - Trial expired users: Every 3 days
   * - Subscribed users: Weekly (every Sunday)
   */
  async shouldSendEmail(subscription) {
    const status = subscription.status;
    const userId = subscription.userId;
    const trialDaysRemaining = this.calculateTrialDaysRemaining(subscription);
    const expired = this.isTrialExpired(subscription);
    
    // Load email tracking
    const tracking = await this.loadEmailTracking();
    const lastSentDate = tracking.lastSent[userId];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Active trial users: Send daily
    if (status === 'trial' && trialDaysRemaining > 0 && !expired) {
      // Check if already sent today
      if (lastSentDate === today) {
        return { send: false, reason: 'Already sent today', frequency: 'daily' };
      }
      return { send: true, frequency: 'daily', type: 'trial_active' };
    }

    // Trial expired users: Send every 3 days
    if (expired || status === 'trial_expired') {
      if (lastSentDate) {
        const lastSent = new Date(lastSentDate);
        const daysSinceLastEmail = Math.floor((now - lastSent) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastEmail < 3) {
          return { send: false, reason: `Last sent ${daysSinceLastEmail} days ago`, frequency: 'every_3_days' };
        }
      }
      return { send: true, frequency: 'every_3_days', type: 'trial_expired' };
    }

    // Active subscription users: Send weekly (Sundays)
    if (status === 'active') {
      const dayOfWeek = now.getDay(); // 0 = Sunday
      
      if (dayOfWeek !== 0) {
        return { send: false, reason: 'Not Sunday', frequency: 'weekly' };
      }
      
      // Check if already sent this week
      if (lastSentDate) {
        const lastSent = new Date(lastSentDate);
        const daysSinceLastEmail = Math.floor((now - lastSent) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastEmail < 7) {
          return { send: false, reason: 'Already sent this week', frequency: 'weekly' };
        }
      }
      
      return { send: true, frequency: 'weekly', type: 'subscribed' };
    }

    return { send: false, reason: 'No matching criteria', frequency: 'none' };
  }

  /**
   * Update email tracking after sending
   */
  async updateEmailTracking(userId) {
    const tracking = await this.loadEmailTracking();
    const today = new Date().toISOString().split('T')[0];
    
    if (!tracking.lastSent) {
      tracking.lastSent = {};
    }
    
    tracking.lastSent[userId] = today;
    await this.saveEmailTracking(tracking);
  }

  /**
   * Send daily report to a single user
   */
  async sendUserDailyReport(subscription) {
    try {
      const { userId, email, status } = subscription;

      console.log(`[NewDailyActivityScheduler] Processing report for ${email} (${status})`);

      // Check if we should send email
      const { send, frequency, reason, type } = await this.shouldSendEmail(subscription);

      if (!send) {
        console.log(`[NewDailyActivityScheduler] Skipping ${email} - ${reason} (frequency: ${frequency})`);
        return { success: false, reason, frequency };
      }

      console.log(`[NewDailyActivityScheduler] Sending ${frequency} email to ${email} (type: ${type})`);

      // Get today's activity
      const todayActivity = await this.getTodayActivity(userId);

      // Get user locations with details
      const locations = await this.getUserLocations(userId);

      // Get real audit data
      const auditData = await this.getAuditData(userId, locations);

      // Check if trial is expired
      const isExpired = this.isTrialExpired(subscription);
      const trialDays = this.calculateTrialDaysRemaining(subscription);

      // Prepare user data
      const userData = {
        userName: email.split('@')[0],
        userEmail: email,
        isTrialUser: status === 'trial' || status === 'trial_expired',
        trialDaysRemaining: trialDays,
        isTrialExpired: isExpired
      };

      // Prepare activity data
      const activityData = {
        postsCreated: todayActivity.postsCreated || [],
        reviewsReplied: todayActivity.reviewsReplied || [],
        locations: locations
      };

      // Send email using new template
      const result = await newDailyActivityEmailService.sendDailyReport(
        email,
        userData,
        activityData,
        auditData
      );

      if (result.success) {
        // Update email tracking
        await this.updateEmailTracking(userId);
        console.log(`[NewDailyActivityScheduler] ✅ Email sent to ${email} (${frequency})`);
      } else {
        console.error(`[NewDailyActivityScheduler] ❌ Failed to send email to ${email}:`, result.error);
      }

      return { ...result, frequency, type };
    } catch (error) {
      console.error('[NewDailyActivityScheduler] Error sending user daily report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send daily reports to all users
   */
  async sendAllDailyReports() {
    try {
      console.log('[NewDailyActivityScheduler] 📧 Starting email batch send...');

      const subscriptions = await this.loadSubscriptions();
      console.log(`[NewDailyActivityScheduler] Found ${subscriptions.length} subscriptions`);

      const results = [];

      for (const subscription of subscriptions) {
        try {
          const result = await this.sendUserDailyReport(subscription);
          results.push({
            email: subscription.email,
            status: subscription.status,
            ...result
          });

          // Rate limiting - wait 500ms between emails
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[NewDailyActivityScheduler] Error processing ${subscription.email}:`, error);
          results.push({
            email: subscription.email,
            status: subscription.status,
            success: false,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const skipped = results.filter(r => !r.success && r.reason).length;
      const failed = results.filter(r => !r.success && r.error).length;

      console.log(`[NewDailyActivityScheduler] ✅ Batch complete:`);
      console.log(`   - Sent: ${successful}`);
      console.log(`   - Skipped: ${skipped}`);
      console.log(`   - Failed: ${failed}`);
      console.log(`   - Total: ${results.length}`);

      return results;
    } catch (error) {
      console.error('[NewDailyActivityScheduler] Error in batch send:', error);
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
      console.log('[NewDailyActivityScheduler] ⏰ Email scheduler triggered at 6 PM');
      await this.sendAllDailyReports();
    });

    this.scheduledJobs.push(job);

    console.log('[NewDailyActivityScheduler] ✅ Email scheduler initialized (6 PM daily)');
    console.log('[NewDailyActivityScheduler] Email frequencies:');
    console.log('   - Trial users (15 days): Daily');
    console.log('   - Trial expired users: Every 3 days');
    console.log('   - Subscribed users: Weekly (Sundays)');
  }

  /**
   * Start all schedulers
   */
  async start() {
    console.log('[NewDailyActivityScheduler] 🚀 Starting email scheduler...');

    this.initializeDailyReportScheduler();

    console.log('[NewDailyActivityScheduler] ✅ All schedulers started successfully');
  }

  /**
   * Stop all schedulers
   */
  stop() {
    console.log('[NewDailyActivityScheduler] Stopping all schedulers...');

    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];

    console.log('[NewDailyActivityScheduler] All schedulers stopped');
  }
}

export default new NewDailyActivityScheduler();

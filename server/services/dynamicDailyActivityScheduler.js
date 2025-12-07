import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import newDailyActivityEmailService from './newDailyActivityEmailService.js';
import supabaseSubscriptionService from './supabaseSubscriptionService.js';
import supabaseAuditService from './supabaseAuditService.js';
import supabaseTokenStorage from './supabaseTokenStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dynamic Daily Activity Scheduler
 * Sends emails with real database data:
 * - Daily emails for trial users
 * - Weekly emails for subscribed users
 * - Fetches real activity data, audit data, and subscription status
 */
class DynamicDailyActivityScheduler {
  constructor() {
    this.scheduledJobs = [];
    this.emailTracking = new Map(); // Track last email sent time for each user

    console.log('[DynamicDailyActivityScheduler] Initializing...');
  }

  /**
   * Calculate trial days remaining
   */
  calculateTrialDaysRemaining(trialEndDate) {
    if (!trialEndDate) return 0;

    const now = new Date();
    const endDate = new Date(trialEndDate);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Check if user is in trial period
   */
  isUserInTrial(subscription) {
    if (subscription.status !== 'trial') return false;

    const trialEndDate = new Date(subscription.trial_end_date || subscription.trialEndDate);
    const now = new Date();

    return now < trialEndDate;
  }

  /**
   * Check if trial is expired
   */
  isTrialExpired(subscription) {
    if (subscription.status !== 'trial') return false;

    const trialEndDate = new Date(subscription.trial_end_date || subscription.trialEndDate);
    const now = new Date();

    return now >= trialEndDate;
  }

  /**
   * Get user activity data from Supabase automation_logs table
   */
  async getUserActivityData(userId, timeframe = 'today') {
    try {
      await supabaseAuditService.initialize();

      const now = new Date();
      let startDate;

      if (timeframe === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
      } else if (timeframe === 'week') {
        startDate = new Date(now.setDate(now.getDate() - 7));
      }

      // Fetch posts created from automation_logs table
      const { data: postsData, error: postsError } = await supabaseAuditService.client
        .from('automation_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('action_type', 'post_created')
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString());

      if (postsError) {
        console.error('[DynamicDailyActivityScheduler] Error fetching posts:', postsError);
      }

      // Fetch reviews replied from automation_logs table
      const { data: reviewsData, error: reviewsError } = await supabaseAuditService.client
        .from('automation_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('action_type', 'review_replied')
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString());

      if (reviewsError) {
        console.error('[DynamicDailyActivityScheduler] Error fetching reviews:', reviewsError);
      }

      // Format the data to match expected structure
      const postsCreated = (postsData || []).map(log => ({
        postId: log.details?.postId || '',
        content: log.details?.content || '',
        timestamp: log.created_at,
        locationId: log.location_id
      }));

      const reviewsReplied = (reviewsData || []).map(log => ({
        reviewId: log.review_id || log.details?.reviewId || '',
        replyText: log.details?.replyText || '',
        rating: log.details?.rating || 0,
        timestamp: log.created_at,
        locationId: log.location_id
      }));

      console.log(`[DynamicDailyActivityScheduler] 📊 Fetched activity for ${userId}:`, {
        postsCreated: postsCreated.length,
        reviewsReplied: reviewsReplied.length,
        timeframe
      });

      return {
        postsCreated,
        reviewsReplied,
        locations: [] // This gets filled later with getUserLocationsCount
      };
    } catch (error) {
      console.error('[DynamicDailyActivityScheduler] Error fetching activity data from Supabase:', error);
      return {
        postsCreated: [],
        reviewsReplied: [],
        locations: []
      };
    }
  }

  /**
   * Get latest audit data for user
   */
  async getUserAuditData(userId) {
    try {
      await supabaseAuditService.initialize();

      // Get the most recent audit result for this user
      const { data, error } = await supabaseAuditService.client
        .from('audit_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.log(`[DynamicDailyActivityScheduler] No audit data found for user ${userId}`);
        return null;
      }

      // Parse audit data
      const auditData = data.audit_data || {};

      return {
        googleSearchRank: auditData.googleSearchRank || auditData.searchRank || 5,
        profileCompletion: auditData.profileCompletion || 67,
        seoScore: auditData.seoScore || 100,
        reviewReplyScore: auditData.reviewReplyScore || 100
      };
    } catch (error) {
      console.error('[DynamicDailyActivityScheduler] Error fetching audit data:', error);
      return null;
    }
  }

  /**
   * Get user's connected locations count
   */
  async getUserLocationsCount(gbpAccountId) {
    try {
      // Query user's connected GBP locations
      const tokens = await supabaseTokenStorage.getTokens(gbpAccountId);

      if (!tokens || !tokens.length) {
        return 1; // Default to 1 if no tokens found
      }

      // You could also query the actual locations from GBP API here
      return tokens.length;
    } catch (error) {
      console.error('[DynamicDailyActivityScheduler] Error getting locations count:', error);
      return 1;
    }
  }

  /**
   * Check if email should be sent based on frequency
   * UPDATED: Send to ALL users daily (trial AND subscribed) at 6 PM
   */
  shouldSendEmail(subscription) {
    const userId = subscription.user_id || subscription.userId;
    const status = subscription.status;
    const lastSent = this.emailTracking.get(userId);

    const now = new Date();

    // 🔧 FIX: Send to EVERYONE daily at 6 PM (trial AND subscribed users)
    // Check if already sent TODAY (not 24 hours ago)
    if (!lastSent) {
      return true; // Never sent before - send now
    }

    // Check if already sent today
    const today = now.toDateString();
    const lastSentDate = new Date(lastSent).toDateString();

    // If not sent today, send now
    if (today !== lastSentDate) {
      return true;
    }

    // Already sent today - skip
    console.log(`[DynamicDailyActivityScheduler] ⏭️ Already sent today to ${subscription.email}`);
    return false;
  }

  /**
   * Send daily activity email for a single user
   */
  async sendUserDailyReport(subscription) {
    try {
      const userId = subscription.user_id || subscription.userId;
      const email = subscription.email;
      const gbpAccountId = subscription.gbp_account_id || subscription.gbpAccountId;

      console.log(`[DynamicDailyActivityScheduler] 📧 Sending daily email to ${email} (Status: ${subscription.status})`);

      // 🔧 REMOVED shouldSendEmail() check - Cron ONLY runs at 6 PM daily
      // No timing issues - guaranteed to send at EXACTLY 6 PM every day
      console.log(`[DynamicDailyActivityScheduler] ✅ Email will be sent - no blocking checks`);

      // Determine if user is in trial
      const isTrialUser = this.isUserInTrial(subscription);
      const isTrialExpired = this.isTrialExpired(subscription);
      const trialDaysRemaining = this.calculateTrialDaysRemaining(
        subscription.trial_end_date || subscription.trialEndDate
      );

      // Get user name from email (you could also store this in subscriptions table)
      const userName = email.split('@')[0];

      // Fetch real activity data
      const timeframe = subscription.status === 'trial' ? 'today' : 'week';
      const activityData = await this.getUserActivityData(userId, timeframe);

      // Add locations count
      const locationsCount = await this.getUserLocationsCount(gbpAccountId);
      activityData.locations = Array(locationsCount).fill({ id: 'location', name: 'Location' });

      // Fetch real audit data
      const auditData = await this.getUserAuditData(userId);

      // Prepare user data
      const userData = {
        userName: userName,
        userEmail: email,
        isTrialUser: isTrialUser,
        trialDaysRemaining: trialDaysRemaining,
        isTrialExpired: isTrialExpired
      };

      console.log(`[DynamicDailyActivityScheduler] 📊 Sending email to ${email}:`, {
        status: subscription.status,
        isTrialUser,
        trialDaysRemaining,
        postsCreated: activityData.postsCreated.length,
        reviewsReplied: activityData.reviewsReplied.length,
        locations: activityData.locations.length,
        hasAuditData: !!auditData
      });

      // Send email
      const result = await newDailyActivityEmailService.sendDailyReport(
        email,
        userData,
        activityData,
        auditData
      );

      if (result.success) {
        // Update email tracking (for logging only, not for blocking)
        this.emailTracking.set(userId, new Date());
        console.log(`[DynamicDailyActivityScheduler] ✅ Email successfully sent to ${email} at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}`);
      } else {
        console.error(`[DynamicDailyActivityScheduler] ❌ Failed to send email to ${email}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error('[DynamicDailyActivityScheduler] ❌ Error sending email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send emails to all users based on their subscription status
   */
  async sendAllDailyReports() {
    try {
      console.log('[DynamicDailyActivityScheduler] 🚀 Starting daily email batch...');

      // Load all subscriptions from Supabase
      const subscriptions = await supabaseSubscriptionService.getAllSubscriptions();
      console.log(`[DynamicDailyActivityScheduler] Found ${subscriptions.length} subscriptions`);

      const results = {
        total: subscriptions.length,
        sent: 0,
        skipped: 0,
        failed: 0,
        details: []
      };

      // Process each subscription
      for (const subscription of subscriptions) {
        const email = subscription.email;

        try {
          const result = await this.sendUserDailyReport(subscription);

          if (result.success) {
            results.sent++;
          } else if (result.reason) {
            results.skipped++;
          } else {
            results.failed++;
          }

          results.details.push({
            email: email,
            status: subscription.status,
            result: result.success ? 'sent' : (result.reason ? 'skipped' : 'failed'),
            reason: result.reason || result.error
          });

          // 🔧 Add 500ms delay between emails to avoid Gmail rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`[DynamicDailyActivityScheduler] Error processing ${email}:`, error);
          results.failed++;
          results.details.push({
            email: email,
            status: subscription.status,
            result: 'failed',
            error: error.message
          });
        }
      }

      console.log('[DynamicDailyActivityScheduler] 📊 Batch completed:', {
        total: results.total,
        sent: results.sent,
        skipped: results.skipped,
        failed: results.failed
      });

      return results;
    } catch (error) {
      console.error('[DynamicDailyActivityScheduler] ❌ Error in batch send:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start the scheduler
   * Runs daily at 6:00 PM
   */
  start() {
    console.log('[DynamicDailyActivityScheduler] 🚀 Starting scheduler...');

    // Schedule daily email batch at 6:00 PM every day
    const dailyJob = cron.schedule('0 18 * * *', async () => {
      console.log('[DynamicDailyActivityScheduler] ⏰ Running scheduled email batch (6:00 PM)');
      await this.sendAllDailyReports();
    }, {
      timezone: "Asia/Kolkata" // Adjust timezone as needed
    });

    this.scheduledJobs.push(dailyJob);

    console.log('[DynamicDailyActivityScheduler] ✅ Scheduler started successfully');
    console.log('[DynamicDailyActivityScheduler] 📅 ALL users will receive daily emails at 6:00 PM IST');
    console.log('[DynamicDailyActivityScheduler] 📧 Trial users: Show "Upgrade" button in email');
    console.log('[DynamicDailyActivityScheduler] 📧 Subscribed users: NO "Upgrade" button in email');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log('[DynamicDailyActivityScheduler] 🛑 Stopping scheduler...');

    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];

    console.log('[DynamicDailyActivityScheduler] ✅ Scheduler stopped');
  }
}

export default new DynamicDailyActivityScheduler();

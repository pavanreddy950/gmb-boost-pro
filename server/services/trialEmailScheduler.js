import cron from 'node-cron';
import TrialEmailService from './trialEmailService.js';
import SubscriptionService from './subscriptionService.js';
import { createClient } from '@supabase/supabase-js';

class TrialEmailScheduler {
  constructor() {
    this.emailService = new TrialEmailService();
    this.subscriptionService = new SubscriptionService();
    this.scheduledJob = null;

    // Initialize Supabase for email tracking
    const supabaseUrl = process.env.SUPABASE_URL || 'https://atxfghdzuokkggexkrnz.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eGZnaGR6dW9ra2dnZXhrcm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc3NzU3MjYsImV4cCI6MjA0MzM1MTcyNn0.QQE0WVfBGUxdPkpCTZIbbOFVVFmWrUSKJZxf0cXcLqc';

    this.supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[TrialEmailScheduler] ✅ Initialized with Supabase tracking');
  }

  /**
   * Initialize Supabase table for email tracking
   */
  async initializeEmailTracking() {
    try {
      // Check if table exists by trying to select from it
      const { error } = await this.supabase
        .from('trial_emails_sent')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        // Table doesn't exist, log instruction
        console.log('[TrialEmailScheduler] ⚠️ Please create the trial_emails_sent table in Supabase:');
        console.log(`
CREATE TABLE trial_emails_sent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  days_remaining INTEGER NOT NULL,
  email_type TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trial_end_date TIMESTAMP WITH TIME ZONE,
  success BOOLEAN DEFAULT TRUE,
  message_id TEXT,
  UNIQUE(user_id, email_type, days_remaining)
);

CREATE INDEX idx_trial_emails_user_id ON trial_emails_sent(user_id);
CREATE INDEX idx_trial_emails_sent_at ON trial_emails_sent(sent_at);
        `);
      } else {
        console.log('[TrialEmailScheduler] ✅ Email tracking table exists');
      }
    } catch (error) {
      console.error('[TrialEmailScheduler] Error checking email tracking table:', error);
    }
  }

  /**
   * Check if email was already sent
   */
  async wasEmailSent(userId, emailType, daysRemaining) {
    try {
      const { data, error } = await this.supabase
        .from('trial_emails_sent')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', emailType)
        .eq('days_remaining', daysRemaining)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('[TrialEmailScheduler] Error checking if email was sent:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('[TrialEmailScheduler] Error in wasEmailSent:', error);
      return false;
    }
  }

  /**
   * Record sent email in Supabase
   */
  async recordSentEmail(userId, email, daysRemaining, emailType, trialEndDate, success, messageId = null) {
    try {
      const { error } = await this.supabase
        .from('trial_emails_sent')
        .insert({
          user_id: userId,
          email: email,
          days_remaining: daysRemaining,
          email_type: emailType,
          trial_end_date: trialEndDate,
          success: success,
          message_id: messageId
        });

      if (error) {
        console.error('[TrialEmailScheduler] Error recording sent email:', error);
        return false;
      }

      console.log(`[TrialEmailScheduler] ✅ Recorded email for user ${userId} (${emailType}, ${daysRemaining} days)`);
      return true;
    } catch (error) {
      console.error('[TrialEmailScheduler] Error in recordSentEmail:', error);
      return false;
    }
  }

  /**
   * Calculate days remaining in trial
   */
  calculateDaysRemaining(trialEndDate) {
    const now = new Date();
    const endDate = new Date(trialEndDate);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Process trial users and send appropriate emails
   */
  async processTrialUsers() {
    try {
      console.log('[TrialEmailScheduler] 🔍 Checking for trial users needing email reminders...');

      // Get all subscriptions
      const allSubscriptions = this.subscriptionService.getAllSubscriptions();
      let emailsSent = 0;

      for (const subscription of allSubscriptions) {
        // Only process trial subscriptions
        if (subscription.status !== 'trial') {
          continue;
        }

        const daysRemaining = this.calculateDaysRemaining(subscription.trialEndDate);
        const userId = subscription.userId;
        const userEmail = subscription.email;
        const userName = subscription.email?.split('@')[0]; // Use email username as name

        console.log(`[TrialEmailScheduler] Processing user ${userEmail}: ${daysRemaining} days remaining`);

        // Determine which email to send based on days remaining
        let shouldSendEmail = false;
        let emailType = 'reminder';

        if (daysRemaining <= 0) {
          // Trial expired - send weekly
          emailType = 'expired';
          // Check if we sent an expired email in the last 7 days
          const alreadySent = await this.wasEmailSent(userId, emailType, 0);
          shouldSendEmail = !alreadySent;
        } else if (daysRemaining === 1) {
          // Last day
          emailType = 'reminder';
          const alreadySent = await this.wasEmailSent(userId, emailType, 1);
          shouldSendEmail = !alreadySent;
        } else if (daysRemaining === 3) {
          // 3 days before expiry
          emailType = 'reminder';
          const alreadySent = await this.wasEmailSent(userId, emailType, 3);
          shouldSendEmail = !alreadySent;
        } else if (daysRemaining === 7) {
          // 7 days before expiry
          emailType = 'reminder';
          const alreadySent = await this.wasEmailSent(userId, emailType, 7);
          shouldSendEmail = !alreadySent;
        } else if (daysRemaining > 1) {
          // During trial - send daily reminders
          emailType = 'reminder';
          const alreadySent = await this.wasEmailSent(userId, emailType, daysRemaining);
          shouldSendEmail = !alreadySent;
        }

        if (shouldSendEmail) {
          console.log(`[TrialEmailScheduler] 📧 Sending ${emailType} email to ${userEmail}`);

          // Format trial end date
          const trialEndDate = new Date(subscription.trialEndDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // Send email
          const result = await this.emailService.sendTrialReminderEmail(
            userEmail,
            userName,
            Math.max(0, daysRemaining),
            trialEndDate,
            emailType
          );

          // Record in Supabase
          await this.recordSentEmail(
            userId,
            userEmail,
            Math.max(0, daysRemaining),
            emailType,
            subscription.trialEndDate,
            result.success,
            result.messageId
          );

          if (result.success) {
            emailsSent++;
          }

          // Add delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log(`[TrialEmailScheduler] ⏭️ Skipping ${userEmail} - email already sent for ${daysRemaining} days remaining`);
        }
      }

      console.log(`[TrialEmailScheduler] ✅ Email check complete - ${emailsSent} email(s) sent`);
    } catch (error) {
      console.error('[TrialEmailScheduler] ❌ Error processing trial users:', error);
    }
  }

  /**
   * Start the email scheduler
   * Runs daily at 9:00 AM
   */
  start() {
    if (this.scheduledJob) {
      console.log('[TrialEmailScheduler] ⚠️ Scheduler is already running');
      return;
    }

    // Initialize email tracking table
    this.initializeEmailTracking();

    // Schedule to run daily at 9:00 AM
    // Cron format: minute hour day month dayOfWeek
    // '0 9 * * *' = Every day at 9:00 AM
    this.scheduledJob = cron.schedule('0 9 * * *', async () => {
      console.log('[TrialEmailScheduler] ⏰ Running scheduled email check at 9:00 AM');
      await this.processTrialUsers();
    });

    console.log('[TrialEmailScheduler] ✅ Email scheduler started - will run daily at 9:00 AM');

    // Run initial check immediately (for testing)
    console.log('[TrialEmailScheduler] 🚀 Running initial email check...');
    this.processTrialUsers();
  }

  /**
   * Stop the email scheduler
   */
  stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
      console.log('[TrialEmailScheduler] ⏸️ Email scheduler stopped');
    }
  }

  /**
   * Run email check manually (for testing)
   */
  async runManualCheck() {
    console.log('[TrialEmailScheduler] 🧪 Running manual email check...');
    await this.processTrialUsers();
  }

  /**
   * Send test email
   */
  async sendTestEmail(email) {
    console.log(`[TrialEmailScheduler] 🧪 Sending test email to ${email}`);
    return await this.emailService.sendTestEmail(email);
  }
}

export default TrialEmailScheduler;

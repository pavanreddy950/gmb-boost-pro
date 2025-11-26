import schedule from 'node-schedule';
import TrialEmailService from './trialEmailService.js';
import SubscriptionService from './subscriptionService.js';
import connectionPool from '../database/connectionPool.js';

/**
 * Trial Email Scheduler
 * Sends automated trial reminder emails
 * Now using centralized connection pool
 */
class TrialEmailScheduler {
  constructor() {
    this.emailService = new TrialEmailService();
    this.subscriptionService = new SubscriptionService();
    this.scheduledJob = null;
    this.isRunning = false;
    this.supabase = null;
  }

  async initialize() {
    if (!this.supabase) {
      console.log('[TrialEmailScheduler] Getting Supabase client from connection pool...');
      this.supabase = await connectionPool.getClient();
      console.log('[TrialEmailScheduler] ✅ Using centralized connection pool');
    }
  }

  /**
   * Start the email scheduler
   */
  async start() {
    if (this.isRunning) {
      console.log('[TrialEmailScheduler] Scheduler already running');
      return;
    }

    // Initialize connection pool
    await this.initialize();

    console.log('[TrialEmailScheduler] 📧 Starting trial email automation...');
    console.log('[TrialEmailScheduler] Schedule: Daily at 9:00 AM (America/New_York)');

    // Schedule to run daily at 9 AM EST
    // node-schedule syntax: scheduleJob(cronPattern, callback, options)
    this.scheduledJob = schedule.scheduleJob(
      '0 9 * * *',
      async () => {
        console.log('[TrialEmailScheduler] ⏰ Daily job triggered');
        await this.sendTrialReminders();
      }
    );

    this.isRunning = true;
    console.log('[TrialEmailScheduler] ✅ Scheduler started successfully');
  }

  /**
   * Send trial reminder emails
   */
  async sendTrialReminders() {
    console.log('[TrialEmailScheduler] Running trial reminder check...');
    // Implementation would go here - this is a placeholder
    // In the actual implementation, this would:
    // 1. Query users with active trials
    // 2. Check trial end dates
    // 3. Send appropriate reminder emails
  }

  /**
   * Stop the email scheduler
   */
  stop() {
    if (this.scheduledJob) {
      this.scheduledJob.cancel();
      this.scheduledJob = null;
      this.isRunning = false;
      console.log('[[TrialEmailScheduler] ⏸️  Email scheduler stopped');
    }
  }
}

export default TrialEmailScheduler;

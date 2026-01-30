import cron from 'node-cron';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabaseTokenStorage from './supabaseTokenStorage.js';
import supabaseAutomationService from './supabaseAutomationService.js';
import subscriptionGuard from './subscriptionGuard.js';
import appConfig from '../config.js';
import { getCategoryMapping, generateCategoryPrompt } from '../config/categoryReviewMapping.js';
import scheduledPostsService from './scheduledPostsService.js';
import photoService from './photoService.js';
import { postToSocialMedia } from './socialMediaPoster.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default timezone for all scheduled tasks (IST - Indian Standard Time)
const DEFAULT_TIMEZONE = appConfig.timezone || 'Asia/Kolkata';

class AutomationScheduler {
  constructor() {
    // REMOVED: JSON file storage - now using Supabase only
    this.settings = { automations: {} }; // In-memory cache, loaded from Supabase
    this.scheduledJobs = new Map();
    this.reviewCheckIntervals = new Map();

    // Post creation locks to prevent duplicate posts (fixes 3 posts at same time issue)
    this.postCreationLocks = new Map(); // locationId -> timestamp of last post creation
    this.postingInProgress = new Map(); // locationId -> true/false to prevent concurrent posting
    this.DUPLICATE_POST_WINDOW = 120 * 1000; // 120 seconds - prevent duplicate posts within this window

    // Azure OpenAI API configuration from environment variables
    this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini-3';
    this.azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

    // Build full Azure OpenAI endpoint URL
    this.openaiEndpoint = this.azureEndpoint
      ? `${this.azureEndpoint}/openai/deployments/${this.azureDeployment}/chat/completions?api-version=${this.azureApiVersion}`
      : '';
    this.openaiApiKey = this.azureApiKey;
    this.openaiModel = this.azureDeployment; // For Azure, model is the deployment name

    // Log Azure OpenAI configuration status
    console.log('[AutomationScheduler] ✅ Azure OpenAI Configuration:');
    console.log(`  - Endpoint: ${this.azureEndpoint ? '✅' : '❌'}`);
    console.log(`  - Deployment: ${this.azureDeployment}`);
    console.log(`  - API Key: ${this.azureApiKey ? '✅ Configured' : '❌ NOT SET'}`);
  }

  // Load settings from Supabase (called on initialization)
  async loadSettings() {
    try {
      console.log('[AutomationScheduler] 📥 Loading automation settings from Supabase...');
      const allSettings = await supabaseAutomationService.getAllEnabledAutomations();

      // Convert Supabase format to existing format for compatibility
      this.settings = { automations: {} };
      for (const setting of allSettings) {
        // formatSettings returns camelCase properties: locationId, userId, etc.
        const locationId = setting.locationId || setting.location_id;

        if (!locationId) {
          console.error(`[AutomationScheduler] ❌ Skipping setting without location_id:`, setting);
          continue;
        }

        // The setting object already has the full settings merged in from formatSettings
        // Use the setting object directly instead of trying to parse setting.settings
        this.settings.automations[locationId] = setting;

        // 🚀 ALWAYS ENABLE AUTO-POSTING FOR ALL PROFILES
        // User requirement: Auto-posting must be ON for EVERY business profile
        if (setting.autoPosting) {
          if (!setting.autoPosting.enabled) {
            console.log(`[AutomationScheduler] 🚀 Force-enabling autoPosting for location ${locationId}`);
          }
          setting.autoPosting.enabled = true;
          this.settings.automations[locationId].autoPosting.enabled = true;

          // 🔧 CRITICAL FIX: Ensure userId, accountId, and businessName are always populated in autoPosting
          // This fixes the issue where automated posts don't find the correct user token or business name
          if (!setting.autoPosting.userId) {
            console.log(`[AutomationScheduler] 🔧 Backfilling userId into autoPosting for location ${locationId}`);
            setting.autoPosting.userId = setting.userId;
          }
          if (!setting.autoPosting.gbpAccountId) {
            setting.autoPosting.gbpAccountId = setting.gbpAccountId || setting.accountId;
          }
          if (!setting.autoPosting.accountId) {
            setting.autoPosting.accountId = setting.gbpAccountId || setting.accountId;
          }
          // 🔧 CRITICAL FIX: Backfill businessName into autoPosting for cron job context
          // The cron job only receives autoPosting config, so businessName must be inside it
          if (!setting.autoPosting.businessName) {
            console.log(`[AutomationScheduler] 🔧 Backfilling businessName into autoPosting for location ${locationId}`);
            setting.autoPosting.businessName = setting.businessName;
          }
          // 🔧 CRITICAL FIX: Also backfill locationId for photo attachment
          if (!setting.autoPosting.locationId) {
            setting.autoPosting.locationId = locationId;
          }
        } else {
          // Create autoPosting config if it doesn't exist
          console.log(`[AutomationScheduler] 🚀 Creating autoPosting config for location ${locationId}`);
          setting.autoPosting = {
            enabled: true,
            schedule: '10:20',
            frequency: 'daily',
            timezone: 'Asia/Kolkata',
            userId: setting.userId,
            gbpAccountId: setting.gbpAccountId || setting.accountId,
            accountId: setting.gbpAccountId || setting.accountId,
            businessName: setting.businessName, // Include for cron job context
            locationId: locationId // Include for photo attachment
          };
          this.settings.automations[locationId].autoPosting = setting.autoPosting;
        }

        // 🔧 FIX: Ensure autoReply.enabled is set if database autoReplyEnabled=true
        if (setting.autoReplyEnabled && setting.autoReply) {
          if (!setting.autoReply.enabled) {
            console.log(`[AutomationScheduler] ⚠️ Fixing autoReply.enabled for location ${locationId} - setting to true`);
            setting.autoReply.enabled = true;
            this.settings.automations[locationId].autoReply.enabled = true;
          }
        }

        console.log(`[AutomationScheduler] ✅ Loaded settings for location ${locationId}:`, {
          databaseEnabled: setting.enabled,
          hasAutoPosting: !!setting?.autoPosting,
          autoPostingEnabled: setting?.autoPosting?.enabled,
          schedule: setting?.autoPosting?.schedule,
          frequency: setting?.autoPosting?.frequency,
          hasAutoReply: !!setting?.autoReply,
          autoReplyEnabled: setting?.autoReply?.enabled,
          userId: setting.userId,
          gbpAccountId: setting.gbpAccountId || setting.accountId || 'NOT SET'
        });
      }

      console.log(`[AutomationScheduler] ✅ Loaded ${Object.keys(this.settings.automations).length} automation(s) from Supabase`);
    } catch (error) {
      console.error('[AutomationScheduler] ❌ Error loading settings from Supabase:', error);
      this.settings = { automations: {} };
    }
  }

  // Save settings to Supabase (no more JSON files)
  async saveSettings(settings = this.settings) {
    try {
      console.log('[AutomationScheduler] 💾 Automation settings updated in memory cache');
      // Settings are automatically saved to Supabase via API endpoints
      // This method now just updates the in-memory cache
    } catch (error) {
      console.error('[AutomationScheduler] Error updating settings cache:', error);
    }
  }

  // Get valid token for user with automatic refresh
  async getValidTokenForUser(userId) {
    return await supabaseTokenStorage.getValidToken(userId);
  }

  // Initialize all automation schedules (now async to load from Supabase)
  async initializeAutomations() {
    console.log('[AutomationScheduler] 🚀 Initializing all automations from Supabase...');

    // 🔧 CRITICAL FIX: Clear all posting locks on initialization
    // This prevents stuck locks from previous runs blocking new posts
    console.log('[AutomationScheduler] 🔓 Clearing all posting locks from previous runs...');
    this.postingInProgress.clear();
    this.postCreationLocks.clear();

    // Load settings from Supabase first
    await this.loadSettings();

    const automations = this.settings.automations || {};
    console.log(`[AutomationScheduler] 📋 Processing ${Object.keys(automations).length} total automation settings...`);

    let scheduledCount = 0;
    let skippedCount = 0;
    let noSubscriptionCount = 0;

    for (const [locationId, config] of Object.entries(automations)) {
      console.log(`[AutomationScheduler] 📍 Processing location ${locationId}:`, {
        userId: config.userId,
        hasAutoPosting: !!config.autoPosting,
        autoPostingEnabled: config.autoPosting?.enabled,
        hasAutoReply: !!config.autoReply,
        autoReplyEnabled: config.autoReply?.enabled
      });

      // 🔧 FIX: Check if user has their own google_account_id - SKIP if missing!
      const gbpAccountId = config.autoPosting?.gbpAccountId || config.autoPosting?.accountId || config.gbpAccountId;

      if (!gbpAccountId) {
        console.log(`[AutomationScheduler] ⚠️ SKIPPING ${locationId} (${config.autoPosting?.businessName || 'Unknown'}) - NO google_account_id!`);
        console.log(`  - User: ${config.userId}`);
        console.log(`  - Fix: User needs to reconnect their Google Business Profile, or run /api/debug/backfill-account-ids`);
        noSubscriptionCount++;
        continue; // Skip - don't use wrong account ID!
      }

      // 🔒 DYNAMIC SUBSCRIPTION CHECK - Only schedule for subscribed profiles
      const targetUserId = config.autoPosting?.userId || config.userId || 'default';

      const validationResult = await subscriptionGuard.validateBeforeAutomation(targetUserId, gbpAccountId, 'auto_posting');

      if (!validationResult.allowed) {
        console.log(`[AutomationScheduler] 🚫 Skipping ${locationId} (${config.autoPosting?.businessName || 'Unknown'}) - No valid subscription`);
        console.log(`  - Reason: ${validationResult.reason}`);
        noSubscriptionCount++;
        continue; // Skip profiles without valid subscription
      }

      console.log(`[AutomationScheduler] ✅ Subscription valid for ${config.autoPosting?.businessName || locationId}`);

      if (config.autoPosting?.enabled) {
        console.log(`[AutomationScheduler] ✅ Scheduling auto-posting for location ${locationId}`);
        this.scheduleAutoPosting(locationId, config.autoPosting);
        scheduledCount++;
      } else {
        console.log(`[AutomationScheduler] ⏭️ Skipping auto-posting for location ${locationId} - not enabled`);
        skippedCount++;
      }

      if (config.autoReply?.enabled) {
        console.log(`[AutomationScheduler] ✅ Starting review monitoring for location ${locationId}`);
        // Merge full config with autoReply settings to include businessName, keywords, etc.
        // 🔧 FIX: Also include autoPosting settings as fallback for businessName and keywords
        const fullAutoReplyConfig = {
          ...config.autoReply,
          businessName: config.businessName || config.autoPosting?.businessName,
          keywords: config.keywords || config.autoPosting?.keywords,
          category: config.category || config.autoPosting?.category,
          userId: config.userId,
          accountId: config.accountId,
          gbpAccountId: config.gbpAccountId,
          locationId: locationId, // Include locationId for DB lookup fallback
          autoPosting: config.autoPosting // Include full autoPosting config for fallback data
        };
        this.startReviewMonitoring(locationId, fullAutoReplyConfig);
      } else {
        console.log(`[AutomationScheduler] ⏭️ Skipping review monitoring for location ${locationId} - not enabled`);
      }
    }

    console.log(`[AutomationScheduler] ✅ Initialized ${this.scheduledJobs.size} posting schedules and ${this.reviewCheckIntervals.size} review monitors`);
    console.log(`[AutomationScheduler] 📊 Summary: ${scheduledCount} scheduled, ${skippedCount} not enabled, ${noSubscriptionCount} no subscription`);

    // Start catch-up mechanism to handle missed posts
    this.startMissedPostChecker();

    // Check for missed posts immediately on startup
    console.log('[AutomationScheduler] Running initial check for missed posts...');
    this.checkAndCreateMissedPosts();
  }

  // Start a background checker for missed posts (runs every 1 minute for maximum reliability)
  startMissedPostChecker() {
    if (this.missedPostCheckerInterval) {
      clearInterval(this.missedPostCheckerInterval);
    }

    console.log('[AutomationScheduler] ⏰ Starting missed post checker (every 1 minute)');
    console.log('[AutomationScheduler] ✅ Settings will reload from database every 5 minutes for freshness');

    // Check every 1 minute for any posts that should have been created
    this.missedPostCheckerInterval = setInterval(async () => {
      console.log('[AutomationScheduler] 🔍 Running periodic check for missed posts...');
      await this.checkAndCreateMissedPosts();
    }, 1 * 60 * 1000); // 1 minute for maximum reliability
  }

  // Check for missed posts and create them
  async checkAndCreateMissedPosts() {
    try {
      // IMPORTANT: Reload settings from database every 5 minutes to ensure we have latest data
      // This catches cases where settings were updated but server wasn't notified
      const now = Date.now();
      const SETTINGS_RELOAD_INTERVAL = 5 * 60 * 1000; // 5 minutes

      if (!this.lastSettingsReload || (now - this.lastSettingsReload) > SETTINGS_RELOAD_INTERVAL) {
        console.log('[AutomationScheduler] 🔄 Reloading settings from database to ensure freshness...');
        await this.loadSettings();
        this.lastSettingsReload = now;
      }

      const automations = this.settings.automations || {};

      // Get current time in UTC
      const nowUTC = new Date();

      // Get IST time components (IST = UTC + 5:30)
      const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const nowISTMillis = nowUTC.getTime() + istOffset;
      const nowIST = new Date(nowISTMillis);

      // Extract IST time components
      const currentISTHour = nowIST.getUTCHours();
      const currentISTMinute = nowIST.getUTCMinutes();
      const currentISTDateStr = nowIST.toISOString().split('T')[0]; // YYYY-MM-DD in IST

      console.log(`[AutomationScheduler] 📅 Checking ${Object.keys(automations).length} locations for missed posts`);
      console.log(`[AutomationScheduler] ⏰ Current IST time: ${currentISTHour}:${currentISTMinute.toString().padStart(2, '0')} (${currentISTDateStr})`);

      for (const [locationId, config] of Object.entries(automations)) {
        if (!config.autoPosting?.enabled) {
          continue;
        }

        const autoPosting = config.autoPosting;

        // Get the configured schedule time
        const scheduleTime = autoPosting.schedule || '10:00';
        const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number);

        // Check if we are EXACTLY at the schedule time (within the current minute)
        // This ensures posts happen ONCE at the exact scheduled time
        const isExactScheduleTime = (currentISTHour === scheduleHour && currentISTMinute === scheduleMinute);

        console.log(`[AutomationScheduler] 📊 Location ${locationId} (${autoPosting.businessName || 'Unknown'}):`);
        console.log(`  - Configured schedule: ${scheduleTime} IST`);
        console.log(`  - Current IST: ${currentISTDateStr} ${currentISTHour}:${currentISTMinute.toString().padStart(2, '0')}`);
        console.log(`  - Is exact schedule time: ${isExactScheduleTime}`);
        console.log(`  - Frequency: ${autoPosting.frequency}`);

        // For DAILY frequency: Post ONLY at the exact scheduled time
        // NO "already posted" check - if it's the scheduled time, POST!
        if (autoPosting.frequency === 'daily') {
          console.log(`  - Should post now: ${isExactScheduleTime}`);

          if (isExactScheduleTime) {
            // 🔒 DYNAMIC SUBSCRIPTION CHECK - Only post for subscribed profiles
            const targetUserId = autoPosting.userId || config.userId || 'default';
            const gbpAccountId = autoPosting.gbpAccountId || autoPosting.accountId || config.gbpAccountId;

            console.log(`[AutomationScheduler] 🔒 Pre-check subscription for ${autoPosting.businessName}...`);
            const validationResult = await subscriptionGuard.validateBeforeAutomation(targetUserId, gbpAccountId, 'auto_posting');

            if (!validationResult.allowed) {
              console.log(`[AutomationScheduler] ⏭️ SKIPPING ${locationId} - No valid subscription`);
              console.log(`  - Reason: ${validationResult.reason}`);
              console.log(`  - Message: ${validationResult.message}`);
              continue; // Skip this profile - no valid subscription
            }

            console.log(`[AutomationScheduler] ✅ Subscription valid for ${autoPosting.businessName}`);
            console.log(`[AutomationScheduler] ⚡ POSTING NOW for ${locationId}!`);
            console.log(`  - Business: ${autoPosting.businessName}`);
            console.log(`  - Configured time: ${scheduleTime} IST`);
            console.log(`  - 🕐 Current IST time: ${currentISTHour}:${currentISTMinute.toString().padStart(2, '0')}`);
            console.log(`  - 👤 User ID: ${autoPosting.userId || 'NOT SET'}`);
            console.log(`  - 🏢 Account ID: ${autoPosting.gbpAccountId || autoPosting.accountId || 'NOT SET'}`);

            // Create the post - NO "already posted" check!
            const postResult = await this.createAutomatedPost(locationId, autoPosting);
            if (postResult) {
              console.log(`[AutomationScheduler] ✅ Post created successfully for ${locationId}`);
            } else {
              console.log(`[AutomationScheduler] ⚠️ Post creation returned null for ${locationId} - may have failed or been blocked`);
            }
          }
          continue;
        }

        // For HOURLY/EVERY2HOURS frequencies: Post at exact scheduled minute each hour
        if (autoPosting.frequency === 'hourly' || autoPosting.frequency === 'every2hours') {
          const currentMinute = currentISTMinute;
          const currentHour = currentISTHour;

          // Check if current minute matches scheduled minute
          const isExactMinute = (currentMinute === scheduleMinute);

          // For every2hours, also check if it's the right hour (even hours: 0, 2, 4, 6, etc.)
          let shouldPostHourly = false;
          if (autoPosting.frequency === 'hourly') {
            shouldPostHourly = isExactMinute;
          } else if (autoPosting.frequency === 'every2hours') {
            shouldPostHourly = isExactMinute && (currentHour % 2 === 0);
          }

          console.log(`  - Scheduled minute: ${scheduleMinute}, Current minute: ${currentMinute}`);
          console.log(`  - Is exact minute: ${isExactMinute}`);
          console.log(`  - Should post (${autoPosting.frequency}): ${shouldPostHourly}`);

          if (shouldPostHourly) {
            // 🔒 DYNAMIC SUBSCRIPTION CHECK
            const targetUserId = autoPosting.userId || config.userId || 'default';
            const gbpAccountId = autoPosting.gbpAccountId || autoPosting.accountId || config.gbpAccountId;

            const validationResult = await subscriptionGuard.validateBeforeAutomation(targetUserId, gbpAccountId, 'auto_posting');

            if (!validationResult.allowed) {
              console.log(`[AutomationScheduler] ⏭️ SKIPPING ${locationId} - No valid subscription`);
              continue;
            }

            console.log(`[AutomationScheduler] ⚡ HOURLY POST for ${locationId}!`);
            console.log(`  - Business: ${autoPosting.businessName}`);
            console.log(`  - Frequency: ${autoPosting.frequency}`);
            console.log(`  - Current hour: ${currentHour}`);

            const postResult = await this.createAutomatedPost(locationId, autoPosting);
            if (postResult) {
              console.log(`[AutomationScheduler] ✅ Hourly post created successfully for ${locationId}`);
            } else {
              console.log(`[AutomationScheduler] ⚠️ Hourly post creation returned null for ${locationId}`);
            }
          }
          continue;
        }

        // For any other frequency not handled above, log and skip
        console.log(`  - ⏭️ Unknown frequency: ${autoPosting.frequency}, skipping`);
      }
    } catch (error) {
      console.error('[AutomationScheduler] ❌ Error checking missed posts:', error);
    }
  }

  // Get effective schedule time (user customized or from last post)
  getEffectiveScheduleTime(config, lastRun) {
    // ALWAYS use the configured schedule time - user sets the time, system follows it
    // The userCustomizedTime flag is no longer needed - if user sets a time, use it
    if (config.schedule) {
      console.log(`[AutomationScheduler] 🎯 Using configured schedule time: ${config.schedule}`);
      return config.schedule;
    }

    // Fallback to default time if no schedule configured
    console.log(`[AutomationScheduler] 📌 Using default schedule time: 10:00`);
    return '10:00';
  }

  // Calculate the next scheduled time based on frequency and last run
  calculateNextScheduledTime(config, lastRun) {
    if (!config.schedule || !config.frequency) {
      return null;
    }

    // Get effective time - ALWAYS use the configured schedule
    const effectiveSchedule = this.getEffectiveScheduleTime(config, lastRun);
    const [hour, minute] = effectiveSchedule.split(':').map(Number);

    // IST offset: 5 hours and 30 minutes
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    // Get current UTC time
    const nowUTC = new Date();

    // Calculate current IST components
    const nowISTMillis = nowUTC.getTime() + IST_OFFSET_MS;
    const nowISTDate = new Date(nowISTMillis);
    const currentISTHour = nowISTDate.getUTCHours();
    const currentISTMinute = nowISTDate.getUTCMinutes();
    const currentISTYear = nowISTDate.getUTCFullYear();
    const currentISTMonth = nowISTDate.getUTCMonth();
    const currentISTDay = nowISTDate.getUTCDate();

    // Create scheduled time for TODAY in UTC that corresponds to the IST schedule time
    // If schedule is 13:00 IST, that's 07:30 UTC
    const scheduledTodayUTC = new Date(Date.UTC(currentISTYear, currentISTMonth, currentISTDay, hour, minute, 0, 0));
    // Subtract IST offset to convert IST time to UTC
    scheduledTodayUTC.setTime(scheduledTodayUTC.getTime() - IST_OFFSET_MS);

    console.log(`[AutomationScheduler] 🕐 Schedule Calculation:`);
    console.log(`  - Configured time: ${effectiveSchedule} IST`);
    console.log(`  - Current IST time: ${currentISTHour}:${currentISTMinute.toString().padStart(2, '0')}`);
    console.log(`  - Current UTC time: ${nowUTC.toISOString()}`);
    console.log(`  - Scheduled time today (UTC): ${scheduledTodayUTC.toISOString()}`);
    console.log(`  - Last run: ${lastRun ? new Date(lastRun).toISOString() : 'NEVER'}`);
    console.log(`  - Frequency: ${config.frequency}`);

    // If never run before, schedule for today (or tomorrow if time has passed)
    if (!lastRun) {
      // If time already passed TODAY → schedule for tomorrow
      if (nowUTC.getTime() > scheduledTodayUTC.getTime()) {
        console.log(`[AutomationScheduler] ⏰ Time has passed for today, scheduling for tomorrow`);
        scheduledTodayUTC.setTime(scheduledTodayUTC.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
      } else {
        console.log(`[AutomationScheduler] ✅ Scheduled time is still ahead today - will post at ${effectiveSchedule} IST`);
      }
      return scheduledTodayUTC;
    }

    // Check if we already posted TODAY at the scheduled time
    const lastRunDate = new Date(lastRun);
    const lastRunISTMillis = lastRunDate.getTime() + IST_OFFSET_MS;
    const lastRunISTDate = new Date(lastRunISTMillis);
    const lastRunISTDateStr = lastRunISTDate.toISOString().split('T')[0];
    const currentISTDateStr = nowISTDate.toISOString().split('T')[0];
    const isSameDay = lastRunISTDateStr === currentISTDateStr;

    console.log(`  - Last run was same day as today (IST): ${isSameDay}`);

    // For daily frequency: Check if scheduled time TODAY is still ahead
    if (config.frequency === 'daily') {
      // If we already posted today, next post is tomorrow
      if (isSameDay) {
        console.log(`[AutomationScheduler] 📅 Already posted today, next post tomorrow at ${effectiveSchedule} IST`);
        scheduledTodayUTC.setTime(scheduledTodayUTC.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
        return scheduledTodayUTC;
      }

      // If scheduled time hasn't passed today, post today
      if (nowUTC.getTime() < scheduledTodayUTC.getTime()) {
        console.log(`[AutomationScheduler] ✅ Scheduled time hasn't passed - will post TODAY at ${effectiveSchedule} IST`);
        return scheduledTodayUTC;
      }

      // Time passed and we haven't posted today - this is overdue!
      console.log(`[AutomationScheduler] ⚠️ OVERDUE! Should have posted today at ${effectiveSchedule} IST`);
      return scheduledTodayUTC; // Return today's time so it triggers immediately
    }

    // For other frequencies, calculate based on last run
    // Create next run time in UTC based on lastRun date
    const lastRunISTYear = lastRunISTDate.getUTCFullYear();
    const lastRunISTMonth = lastRunISTDate.getUTCMonth();
    const lastRunISTDay = lastRunISTDate.getUTCDate();
    const nextRunUTC = new Date(Date.UTC(lastRunISTYear, lastRunISTMonth, lastRunISTDay, hour, minute, 0, 0));
    nextRunUTC.setTime(nextRunUTC.getTime() - IST_OFFSET_MS); // Convert IST to UTC

    switch (config.frequency) {
      case 'alternative':
        // Every 2 days
        nextRunUTC.setTime(nextRunUTC.getTime() + 2 * 24 * 60 * 60 * 1000);
        break;

      case 'weekly':
        // Next week same day
        nextRunUTC.setTime(nextRunUTC.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;

      case 'twice-weekly':
        // Next occurrence (3 or 4 days based on current day)
        const currentDay = lastRunISTDate.getUTCDay();
        if (currentDay === 1) { // Monday -> Thursday (3 days)
          nextRunUTC.setTime(nextRunUTC.getTime() + 3 * 24 * 60 * 60 * 1000);
        } else { // Thursday -> Monday (4 days)
          nextRunUTC.setTime(nextRunUTC.getTime() + 4 * 24 * 60 * 60 * 1000);
        }
        break;

      case 'test30s':
        // Every 30 seconds from now
        return new Date(nowUTC.getTime() + 30 * 1000);

      default:
        // Unknown frequency, schedule for tomorrow
        nextRunUTC.setTime(nextRunUTC.getTime() + 24 * 60 * 60 * 1000);
    }

    // If next run is in the past, it's overdue
    if (nextRunUTC.getTime() <= nowUTC.getTime()) {
      console.log(`[AutomationScheduler] ⚠️ OVERDUE! Next scheduled time has passed`);
    }

    return nextRunUTC;
  }

  // Update automation settings (now updates Supabase AND in-memory cache)
  async updateAutomationSettings(locationId, settings) {
    console.log(`[AutomationScheduler] 💾 Updating settings for location ${locationId}`);

    if (!this.settings.automations) {
      this.settings.automations = {};
    }

    // Update in-memory cache
    this.settings.automations[locationId] = {
      ...this.settings.automations[locationId],
      ...settings,
      updatedAt: new Date().toISOString()
    };

    // Save to Supabase (not JSON files anymore)
    try {
      const userId = settings.userId || settings.autoPosting?.userId || settings.autoReply?.userId;
      if (userId) {
        await supabaseAutomationService.saveSettings(userId, locationId, {
          ...this.settings.automations[locationId],
          // enabled: settings.autoPosting?.enabled || settings.autoReply?.enabled || false,
          // autoReplyEnabled: settings.autoReply?.enabled || false
          enabled: settings.autoPosting?.enabled === true,
          autoReplyEnabled: settings.autoReply?.enabled === true

        });
        console.log(`[AutomationScheduler] ✅ Settings saved to Supabase for location ${locationId}`);
      }
    } catch (error) {
      console.error('[AutomationScheduler] ❌ Error saving to Supabase:', error);
    }

    // Restart relevant automations
    if (settings.autoPosting !== undefined) {
      console.log(`[AutomationScheduler] 🔄 Restarting auto-posting for ${locationId}`);
      console.log(`[AutomationScheduler]    - New schedule time: ${settings.autoPosting?.schedule || 'NOT SET'}`);
      console.log(`[AutomationScheduler]    - Frequency: ${settings.autoPosting?.frequency || 'NOT SET'}`);
      console.log(`[AutomationScheduler]    - Enabled: ${settings.autoPosting?.enabled}`);
      this.stopAutoPosting(locationId);
      if (settings.autoPosting?.enabled) {
        this.scheduleAutoPosting(locationId, settings.autoPosting);
        console.log(`[AutomationScheduler] ✅ Auto-posting rescheduled for ${locationId}`);
      } else {
        console.log(`[AutomationScheduler] ⏸️ Auto-posting disabled for ${locationId}`);
      }
    }

    if (settings.autoReply !== undefined) {
      this.stopReviewMonitoring(locationId);
      if (settings.autoReply?.enabled) {
        // Merge full settings with autoReply config to include businessName, keywords, etc.
        // 🔧 FIX: Also include autoPosting settings as fallback for businessName and keywords
        const fullAutoReplyConfig = {
          ...settings.autoReply,
          businessName: settings.businessName || settings.autoPosting?.businessName,
          keywords: settings.keywords || settings.autoPosting?.keywords,
          category: settings.category || settings.autoPosting?.category,
          userId: settings.userId,
          accountId: settings.accountId,
          gbpAccountId: settings.gbpAccountId,
          locationId: locationId, // Include locationId for DB lookup fallback
          autoPosting: settings.autoPosting // Include full autoPosting config for fallback data
        };
        this.startReviewMonitoring(locationId, fullAutoReplyConfig);
      }
    }

    return this.settings.automations[locationId];
  }

  // Schedule auto-posting for a location
  scheduleAutoPosting(locationId, config) {
    if (!config.schedule || !config.frequency) {
      console.log(`[AutomationScheduler] No schedule configured for location ${locationId}`);
      return;
    }

    // Stop existing schedule if any
    this.stopAutoPosting(locationId);

    // Get effective schedule time - use previous post time if user hasn't customized
    const effectiveSchedule = this.getEffectiveScheduleTime(config, config.lastRun);
    const [hour, minute] = effectiveSchedule.split(':');

    console.log(`[AutomationScheduler] 🕐 Effective schedule time for ${locationId}: ${effectiveSchedule}`);
    console.log(`[AutomationScheduler]    - User customized: ${config.userCustomizedTime ? 'YES' : 'NO'}`);
    console.log(`[AutomationScheduler]    - Last run: ${config.lastRun || 'NEVER'}`);

    let cronExpression;

    switch (config.frequency) {
      case 'hourly':
        // Every hour at the specified minute
        cronExpression = `${minute} * * * *`;
        break;
      case 'every2hours':
        // Every 2 hours at the specified minute
        cronExpression = `${minute} */2 * * *`;
        break;
      case 'daily':
        // Daily at effective time (user customized or previous post time)
        cronExpression = `${minute} ${hour} * * *`;
        break;
      case 'alternative':
        // For "alternative" (every 2 days), run daily at scheduled time
        // The createAutomatedPost method will check lastRun and only post if 2 days have passed
        cronExpression = `${minute} ${hour} */2 * *`;
        break;
      case 'weekly':
        // Weekly on specified day and time
        const weekDay = config.dayOfWeek || 1; // Default Monday
        cronExpression = `${minute} ${hour} * * ${weekDay}`;
        break;
      case 'twice-weekly':
        // Twice weekly (Monday and Thursday)
        cronExpression = `${minute} ${hour} * * 1,4`;
        break;
      case 'test30s':
        // Test mode - every 30 seconds
        cronExpression = `*/30 * * * * *`;
        break;
      case 'custom':
        // Custom schedule - use first time slot for now
        if (config.customTimes && config.customTimes.length > 0) {
          const [customHour, customMinute] = config.customTimes[0].split(':');
          cronExpression = `${customMinute} ${customHour} * * *`;
        } else {
          console.log(`[AutomationScheduler] No custom times configured`);
          return;
        }
        break;
      default:
        console.log(`[AutomationScheduler] Unknown frequency: ${config.frequency}`);
        return;
    }

    console.log(`[AutomationScheduler] Scheduling auto-posting for location ${locationId} with cron: ${cronExpression}`);
    console.log(`[AutomationScheduler] 📅 Frequency: ${config.frequency}, Schedule: ${config.schedule}, Timezone: ${config.timezone || DEFAULT_TIMEZONE}`);

    const job = cron.schedule(cronExpression, async () => {
      console.log(`[AutomationScheduler] ========================================`);
      console.log(`[AutomationScheduler] ⏰ CRON JOB TRIGGERED!`);
      console.log(`[AutomationScheduler] 📍 Location: ${locationId}`);
      console.log(`[AutomationScheduler] 🏢 Business: ${config.businessName || 'Unknown'}`);
      console.log(`[AutomationScheduler] 🕐 Trigger time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`[AutomationScheduler] 🕐 Trigger time (UTC): ${new Date().toISOString()}`);
      console.log(`[AutomationScheduler] 📅 Frequency: ${config.frequency}`);
      console.log(`[AutomationScheduler] ⏰ Schedule: ${config.schedule}`);
      console.log(`[AutomationScheduler] 🌍 Timezone: ${config.timezone || DEFAULT_TIMEZONE}`);
      console.log(`[AutomationScheduler] 📝 Cron Expression: ${cronExpression}`);
      console.log(`[AutomationScheduler] ========================================`);

      // For frequencies that need interval checking (like "alternative"), verify it's time to post
      /*
      if (config.frequency === 'alternative') {
        const lastRun = config.lastRun ? new Date(config.lastRun) : null;
        const nextScheduledTime = this.calculateNextScheduledTime(config, lastRun);
        const now = new Date();

        if (nextScheduledTime && now < nextScheduledTime) {
          console.log(`[AutomationScheduler] ⏭️  Skipping - Next post scheduled for: ${nextScheduledTime.toISOString()}`);
          console.log(`[AutomationScheduler] ⏱️  Time remaining: ${Math.floor((nextScheduledTime - now) / 1000 / 60 / 60)} hours`);
          return; // Skip this run
        }
      }
      */

      console.log(`[AutomationScheduler] ▶️ Executing createAutomatedPost now...`);
      await this.createAutomatedPost(locationId, config);
      console.log(`[AutomationScheduler] ✅ createAutomatedPost completed`);
    }, {
      scheduled: true,
      timezone: config.timezone || DEFAULT_TIMEZONE
    });

    this.scheduledJobs.set(locationId, job);
    console.log(`[AutomationScheduler] ✅ Cron job registered. Total active jobs: ${this.scheduledJobs.size}`);
  }

  // Stop auto-posting for a location
  stopAutoPosting(locationId) {
    const job = this.scheduledJobs.get(locationId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(locationId);
      console.log(`[AutomationScheduler] Stopped auto-posting for location ${locationId}`);
    }
  }

  // Create an automated post with a provided token
  async createAutomatedPostWithToken(locationId, config, accessToken) {
    try {
      console.log(`[AutomationScheduler] Creating automated post with provided token for location ${locationId}`);
      console.log(`[AutomationScheduler] Config received:`, JSON.stringify(config, null, 2));

      // Ensure userId is set for address fetching
      const userId = config.userId || 'default';
      console.log(`[AutomationScheduler] Using userId for content generation: ${userId}`);

      // ========================================
      // CRITICAL: Token Validation Before Post Creation
      // ========================================
      // Validate that the user has valid tokens before attempting to create a post
      // This prevents automation failures due to expired/revoked tokens
      // SKIP VALIDATION IN TEST MODE - when config.test is true, trust the provided token
      if (userId && userId !== 'default' && !config.test) {
        try {
          console.log(`[AutomationScheduler] 🔐 Validating tokens for user ${userId}...`);
          const tokens = await supabaseTokenStorage.getUserToken(userId);

          if (!tokens || !tokens.access_token) {
            console.error(`[AutomationScheduler] ❌ No valid tokens found for user ${userId}`);
            await supabaseTokenStorage.logTokenFailure(userId, {
              operation: 'auto_post',
              reason: 'no_tokens',
              locationId: locationId
            });
            return null; // Pause automation by returning null
          }

          // Check if token is expired
          const now = Date.now();
          const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).getTime() : (tokens.created_at + (tokens.expires_in * 1000));

          if (now >= expiresAt) {
            console.error(`[AutomationScheduler] ❌ Token expired for user ${userId}`);
            console.error(`[AutomationScheduler] Token expired at: ${new Date(expiresAt).toISOString()}`);
            console.error(`[AutomationScheduler] Current time: ${new Date(now).toISOString()}`);

            await supabaseTokenStorage.logTokenFailure(userId, {
              operation: 'auto_post',
              reason: 'token_expired',
              locationId: locationId,
              expiredAt: new Date(expiresAt).toISOString()
            });

            return null; // Pause automation by returning null
          }

          console.log(`[AutomationScheduler] ✅ Token valid for user ${userId}, expires: ${new Date(expiresAt).toISOString()}`);

        } catch (tokenError) {
          console.error(`[AutomationScheduler] ❌ Token validation failed:`, tokenError);
          await supabaseTokenStorage.logTokenFailure(userId, {
            operation: 'auto_post',
            reason: 'validation_error',
            locationId: locationId,
            error: tokenError.message
          });
          return null; // Pause automation by returning null
        }
      } else if (config.test) {
        console.log(`[AutomationScheduler] ⚡ TEST MODE: Skipping token validation, using provided token directly`);
      }
      // ========================================

      // Generate post content using AI
      const postContent = await this.generatePostContent(config, locationId, userId);

      // Create the post via Google Business Profile API (v4 - current version)
      // v4 requires accountId in the path
      // Use the account ID from config (passed from user's GBP connection)
      const accountId = config.accountId || config.gbpAccountId || process.env.HARDCODED_ACCOUNT_ID;

      if (!accountId) {
        console.error(`[AutomationScheduler] ❌ No account ID available for location ${locationId}`);
        console.error(`[AutomationScheduler] config.accountId: ${config.accountId}`);
        console.error(`[AutomationScheduler] config.gbpAccountId: ${config.gbpAccountId}`);
        return null;
      }

      console.log(`[AutomationScheduler] 🏢 Using Account ID: ${accountId}`);
      const postUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
      console.log(`[AutomationScheduler] Posting to URL: ${postUrl}`);

      // 📸 Check for pending photo to attach
      let pendingPhoto = null;
      try {
        console.log(`[AutomationScheduler] ========================================`);
        console.log(`[AutomationScheduler] 📸 PHOTO ATTACHMENT CHECK`);
        console.log(`[AutomationScheduler] 📸 Location ID: ${locationId}`);
        console.log(`[AutomationScheduler] 📸 Business: ${config.businessName || 'Unknown'}`);
        console.log(`[AutomationScheduler] 📸 User ID: ${config.userId || 'NOT SET'}`);

        // 🔧 FIX: Check if photo was already passed from API endpoint (avoids race condition)
        if (config.pendingPhoto) {
          pendingPhoto = config.pendingPhoto;
          console.log(`[AutomationScheduler] 📸 Using photo PASSED from API endpoint: ${pendingPhoto.photo_id}`);
        } else {
          console.log(`[AutomationScheduler] 📸 Calling photoService.getNextPendingPhoto()...`);
          pendingPhoto = await photoService.getNextPendingPhoto(locationId);
        }

        if (pendingPhoto) {
          console.log(`[AutomationScheduler] 📸 ✅ FOUND PENDING PHOTO!`);
          console.log(`[AutomationScheduler] 📸 Photo ID: ${pendingPhoto.photo_id}`);
          console.log(`[AutomationScheduler] 📸 Queue Position: ${pendingPhoto.queue_position}`);
          console.log(`[AutomationScheduler] 📸 Public URL: ${pendingPhoto.public_url}`);
          console.log(`[AutomationScheduler] 📸 Status: ${pendingPhoto.status}`);
          console.log(`[AutomationScheduler] 📸 MIME Type: ${pendingPhoto.mime_type || 'N/A'}`);
        } else {
          console.log(`[AutomationScheduler] 📷 No pending photos found for location: ${locationId}`);
          console.log(`[AutomationScheduler] 📷 Post will be created WITHOUT an image`);
        }
        console.log(`[AutomationScheduler] ========================================`);
      } catch (photoError) {
        console.error(`[AutomationScheduler] ⚠️ Error checking for photos:`, photoError.message);
        console.error(`[AutomationScheduler] ⚠️ Full error:`, photoError);
        console.log(`[AutomationScheduler] ⚠️ Post will be created WITHOUT an image due to error`);
      }

      const postData = {
        languageCode: 'en',
        summary: postContent.content,
        topicType: config.topicType || 'STANDARD'
      };

      // 📸 Add photo media if available
      if (pendingPhoto && pendingPhoto.public_url) {
        console.log(`[AutomationScheduler] 📸 Attaching photo to post: ${pendingPhoto.public_url}`);
        postData.media = [{
          mediaFormat: 'PHOTO',
          sourceUrl: pendingPhoto.public_url
        }];
      }

      // Add call to action if generated
      if (postContent.callToAction) {
        console.log('[AutomationScheduler] Adding CTA to post:', postContent.callToAction);
        postData.callToAction = postContent.callToAction;
      } else {
        console.log('[AutomationScheduler] No CTA to add to post');
      }

      // 📸 Log the final post data being sent
      console.log(`[AutomationScheduler] ========================================`);
      console.log(`[AutomationScheduler] 📤 SENDING POST TO GOOGLE API`);
      console.log(`[AutomationScheduler] 📤 Post URL: ${postUrl}`);
      console.log(`[AutomationScheduler] 📸 HAS PHOTO: ${!!postData.media ? 'YES ✅' : 'NO ❌'}`);
      if (postData.media) {
        console.log(`[AutomationScheduler] 📸 Photo URL: ${postData.media[0]?.sourceUrl}`);
      }
      console.log(`[AutomationScheduler] 📤 Full post data:`, JSON.stringify(postData, null, 2));
      console.log(`[AutomationScheduler] ========================================`);

      const response = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[AutomationScheduler] ✅ Successfully created post for location ${locationId}:`, result.name || result.id);

        // 📸 Mark photo as used and delete from storage if one was attached
        if (pendingPhoto) {
          try {
            await photoService.markPhotoAsUsed(pendingPhoto.photo_id, result.name || result.id);
            console.log(`[AutomationScheduler] 📸 Photo ${pendingPhoto.photo_id} marked as used and deleted`);
          } catch (photoError) {
            console.error(`[AutomationScheduler] ⚠️ Error marking photo as used:`, photoError.message);
          }
        }

        // Log the post creation
        this.logAutomationActivity(locationId, 'post_created', {
          userId: config.userId || 'system',
          postId: result.name || result.id,
          content: postContent.content,
          hasPhoto: !!pendingPhoto,
          photoId: pendingPhoto?.photo_id,
          timestamp: new Date().toISOString()
        });

        // 📱 Post to social media (Facebook & Instagram) if enabled
        try {
          const gmailId = config.userId || config.autoPosting?.userId;
          if (gmailId) {
            console.log(`[AutomationScheduler] 📱 Attempting social media posting for user ${gmailId}...`);
            const imageUrl = pendingPhoto?.public_url || null;
            const socialResults = await postToSocialMedia(gmailId, locationId, postContent.content, imageUrl);

            if (socialResults.facebook?.success) {
              console.log(`[AutomationScheduler] 📘 Facebook post created: ${socialResults.facebook.postId}`);
            }
            if (socialResults.instagram?.success) {
              console.log(`[AutomationScheduler] 📸 Instagram post created: ${socialResults.instagram.postId}`);
            }
            if (!socialResults.facebook?.success && !socialResults.instagram?.success) {
              console.log(`[AutomationScheduler] 📱 No social media posts created (not enabled or no credentials)`);
            }
          }
        } catch (socialError) {
          console.error(`[AutomationScheduler] ⚠️ Social media posting error (non-fatal):`, socialError.message);
        }

        return result; // Return success result
      } else {
        const errorText = await response.text();
        console.error(`[AutomationScheduler] ❌ Failed to create post for location ${locationId}`);
        console.error(`[AutomationScheduler] HTTP Status: ${response.status} ${response.statusText}`);
        console.error(`[AutomationScheduler] Error Response:`, errorText);
        console.error(`[AutomationScheduler] Post URL used: ${postUrl}`);
        console.error(`[AutomationScheduler] Account ID: ${accountId}`);

        // Try fallback to older API if the new one fails
        console.log(`[AutomationScheduler] 🔄 Trying fallback API endpoint...`);
        return await this.createPostWithFallbackAPI(locationId, postContent, accessToken, config, pendingPhoto);
      }
    } catch (error) {
      console.error(`[AutomationScheduler] Error creating automated post:`, error);
      return null; // Return null to indicate failure
    }
  }

  // Fallback method for post creation using alternative API
  async createPostWithFallbackAPI(locationId, postContent, accessToken, config, pendingPhoto = null) {
    try {
      // Use Google My Business API v4 as fallback
      // Use the account ID from config (passed from user's GBP connection)
      const accountId = config.accountId || config.gbpAccountId || process.env.HARDCODED_ACCOUNT_ID;

      if (!accountId) {
        console.error(`[AutomationScheduler] ❌ Fallback: No account ID available for location ${locationId}`);
        return null;
      }

      const fallbackUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;

      console.log(`[AutomationScheduler] Using fallback API: ${fallbackUrl}`);

      const fallbackPostData = {
        languageCode: 'en',
        summary: postContent.content,
        topicType: config.topicType || 'STANDARD'
      };

      // 📸 Add photo media if available (same as primary API)
      if (pendingPhoto && pendingPhoto.public_url) {
        console.log(`[AutomationScheduler] 📸 Fallback: Attaching photo to post: ${pendingPhoto.public_url}`);
        fallbackPostData.media = [{
          mediaFormat: 'PHOTO',
          sourceUrl: pendingPhoto.public_url
        }];
      }

      // Add call to action if available
      if (postContent.callToAction) {
        fallbackPostData.callToAction = postContent.callToAction;
      }

      console.log(`[AutomationScheduler] 📤 Fallback post data:`, JSON.stringify(fallbackPostData, null, 2));

      const response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fallbackPostData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[AutomationScheduler] ✅ Fallback API succeeded for location ${locationId}`);

        // 📸 Mark photo as used and delete from storage if one was attached
        if (pendingPhoto) {
          try {
            await photoService.markPhotoAsUsed(pendingPhoto.photo_id, result.name || result.id);
            console.log(`[AutomationScheduler] 📸 Fallback: Photo ${pendingPhoto.photo_id} marked as used and deleted`);
          } catch (photoError) {
            console.error(`[AutomationScheduler] ⚠️ Fallback: Error marking photo as used:`, photoError.message);
          }
        }

        // 📱 Post to social media (Facebook & Instagram) if enabled
        try {
          const gmailId = config.userId || config.autoPosting?.userId;
          if (gmailId) {
            console.log(`[AutomationScheduler] 📱 Fallback: Attempting social media posting for user ${gmailId}...`);
            const imageUrl = pendingPhoto?.public_url || null;
            const socialResults = await postToSocialMedia(gmailId, locationId, postContent.content, imageUrl);

            if (socialResults.facebook?.success) {
              console.log(`[AutomationScheduler] 📘 Fallback: Facebook post created: ${socialResults.facebook.postId}`);
            }
            if (socialResults.instagram?.success) {
              console.log(`[AutomationScheduler] 📸 Fallback: Instagram post created: ${socialResults.instagram.postId}`);
            }
          }
        } catch (socialError) {
          console.error(`[AutomationScheduler] ⚠️ Fallback: Social media posting error (non-fatal):`, socialError.message);
        }

        return result;
      } else {
        const error = await response.text();
        console.error(`[AutomationScheduler] ❌ Fallback API also failed:`, error);
        return null;
      }
    } catch (error) {
      console.error(`[AutomationScheduler] Fallback API error:`, error);
      return null;
    }
  }

  // Create an automated post
  async createAutomatedPost(locationId, config) {
    try {
      console.log(`[AutomationScheduler] 🤖 Creating automated post for location ${locationId}`);
      console.log(`[AutomationScheduler] Config:`, {
        businessName: config.businessName,
        userId: config.userId,
        frequency: config.frequency,
        schedule: config.schedule
      });

      // 🔒 CHECK IF POSTING IS ALREADY IN PROGRESS FOR THIS LOCATION
      const postingStartTime = this.postingInProgress.get(locationId);
      if (postingStartTime) {
        const lockAge = Date.now() - postingStartTime;
        const lockAgeSeconds = Math.floor(lockAge / 1000);

        // 🔧 SAFETY: If lock is older than 2 minutes, it's probably stuck - clear it
        if (lockAge > 2 * 60 * 1000) {
          console.log(`[AutomationScheduler] ⚠️ STALE LOCK detected for location ${locationId} (${lockAgeSeconds}s old) - clearing it`);
          this.postingInProgress.delete(locationId);
        } else {
          console.log(`[AutomationScheduler] ⏳ POSTING ALREADY IN PROGRESS for location ${locationId} (started ${lockAgeSeconds}s ago)`);
          console.log(`[AutomationScheduler] ✅ Skipping this request - another post is being created`);
          return null; // Exit early - another post operation is in progress
        }
      }

      // Set posting in progress flag with timestamp (for stale lock detection)
      this.postingInProgress.set(locationId, Date.now());

      // 🔒 CHECK FOR DUPLICATE POST PREVENTION LOCK
      const now = Date.now();
      const lastPostTime = this.postCreationLocks.get(locationId);

      if (lastPostTime) {
        const timeSinceLastPost = now - lastPostTime;
        const secondsSinceLastPost = Math.floor(timeSinceLastPost / 1000);

        if (timeSinceLastPost < this.DUPLICATE_POST_WINDOW) {
          console.log(`[AutomationScheduler] 🔒 DUPLICATE POST PREVENTED for location ${locationId}`);
          console.log(`[AutomationScheduler] ⏱️  Last post was ${secondsSinceLastPost} seconds ago (within ${this.DUPLICATE_POST_WINDOW / 1000}s window)`);
          console.log(`[AutomationScheduler] ✅ Skipping this post creation request to prevent duplicates`);
          this.postingInProgress.delete(locationId); // Release the lock
          return null; // Exit early - don't create duplicate post
        }
      }

      // Set lock IMMEDIATELY to prevent race conditions (but DON'T update lastRun yet!)
      // lastRun will be updated ONLY after successful post creation
      this.postCreationLocks.set(locationId, now);
      console.log(`[AutomationScheduler] 🔓 Lock acquired for location ${locationId} at ${new Date(now).toISOString()}`);

      // Try to get a valid token for the configured user first
      let userToken = null;
      const targetUserId = config.userId || 'default';

      console.log(`[AutomationScheduler] ========================================`);
      console.log(`[AutomationScheduler] 🔍 TOKEN RETRIEVAL DIAGNOSTICS`);
      console.log(`[AutomationScheduler] Target User ID: ${targetUserId}`);
      console.log(`[AutomationScheduler] Attempting to get valid token for user: ${targetUserId}`);

      userToken = await this.getValidTokenForUser(targetUserId);

      console.log(`[AutomationScheduler] Token retrieval result:`, {
        hasToken: !!userToken,
        hasAccessToken: !!userToken?.access_token,
        hasRefreshToken: !!userToken?.refresh_token,
        tokenExpiresAt: userToken?.expiresAt ? new Date(userToken.expiresAt).toISOString() : 'N/A'
      });

      if (!userToken) {
        // IMPROVED: Use shared token pool for better reliability
        console.log(`[AutomationScheduler] ❌ No token found for ${targetUserId}`);
        console.log(`[AutomationScheduler] 🔄 Trying shared token pool...`);

        // Try the shared token pool first (more reliable)
        userToken = await supabaseTokenStorage.getAnyValidToken();

        if (userToken) {
          console.log(`[AutomationScheduler] ✅ Using token from pool (original user: ${userToken.poolUserId})`);
        } else {
          // Fallback: Try individual automation user tokens
          console.log(`[AutomationScheduler] 🔍 Pool empty, checking individual automation users...`);
          const userIds = this.getAutomationUserIds();

          if (userIds.length > 0) {
            for (const userId of userIds) {
              if (userId === targetUserId) continue;
              const validToken = await this.getValidTokenForUser(userId);
              if (validToken) {
                userToken = validToken;
                console.log(`[AutomationScheduler] ✅ Using token from fallback user: ${userId}`);
                break;
              }
            }
          }
        }

        if (!userToken) {
          console.error(`[AutomationScheduler] ========================================`);
          console.error(`[AutomationScheduler] ❌ CRITICAL: No valid tokens available!`);
          console.error(`[AutomationScheduler] 💡 SOLUTION: User needs to reconnect to Google Business Profile.`);
          console.error(`[AutomationScheduler] 💡 Go to: Settings > Connections > Connect Google Business Profile`);
          console.error(`[AutomationScheduler] ========================================`);

          this.logAutomationActivity(locationId, 'post_failed', {
            error: 'No valid tokens available',
            timestamp: new Date().toISOString(),
            reason: 'authentication_required',
            userId: targetUserId
          });

          this.postingInProgress.delete(locationId);
          return null;
        }
      }

      console.log(`[AutomationScheduler] ✅ Valid token acquired, proceeding with post creation...`);
      console.log(`[AutomationScheduler] ========================================`);

      // 🔒 SUBSCRIPTION CHECK - Verify user has valid trial or active subscription
      // Try to get account ID from config first, then fall back to database lookup
      let gbpAccountId = config.gbpAccountId || config.accountId;

      // If no account ID in config, try to fetch from database
      if (!gbpAccountId && targetUserId && targetUserId !== 'default') {
        console.log(`[AutomationScheduler] 🔍 No accountId in config, looking up in database for user: ${targetUserId}`);
        try {
          const supabase = await supabaseConfig.ensureInitialized();

          // Try by firebase_uid first
          let { data: user, error } = await supabase
            .from('users')
            .select('google_account_id, gmail_id')
            .eq('firebase_uid', targetUserId)
            .single();

          // If not found by firebase_uid, try by gmail_id
          if (!user && !error) {
            const result = await supabase
              .from('users')
              .select('google_account_id, gmail_id')
              .eq('gmail_id', targetUserId)
              .single();
            user = result.data;
          }

          if (user?.google_account_id) {
            gbpAccountId = user.google_account_id;
            console.log(`[AutomationScheduler] ✅ Found account ID from database: ${gbpAccountId}`);
            // Update config so it's available in createAutomatedPostWithToken
            config.accountId = gbpAccountId;
            config.gbpAccountId = gbpAccountId;
          } else {
            console.warn(`[AutomationScheduler] ⚠️ No google_account_id found in database for user: ${targetUserId}`);
          }
        } catch (dbError) {
          console.error(`[AutomationScheduler] ❌ Error looking up account ID:`, dbError.message);
        }
      }

      console.log(`[AutomationScheduler] 🔒 Validating subscription for user ${targetUserId}, GBP Account: ${gbpAccountId || 'NOT FOUND'}`);

      const validationResult = await subscriptionGuard.validateBeforeAutomation(targetUserId, gbpAccountId, 'auto_posting');

      if (!validationResult.allowed) {
        console.error(`[AutomationScheduler] ❌ SUBSCRIPTION CHECK FAILED`);
        console.error(`[AutomationScheduler] Reason: ${validationResult.reason}`);
        console.error(`[AutomationScheduler] Message: ${validationResult.message}`);
        console.error(`[AutomationScheduler] 🚫 AUTO-POSTING BLOCKED - Trial/Subscription expired!`);

        // Log this blocked attempt
        this.logAutomationActivity(locationId, 'post_failed', {
          userId: targetUserId,
          error: validationResult.message,
          reason: validationResult.reason,
          timestamp: new Date().toISOString(),
          blockedBy: 'subscription_guard'
        });

        return null; // Stop - don't create post
      }

      console.log(`[AutomationScheduler] ✅ Subscription validated - ${validationResult.status} (${validationResult.daysRemaining} days remaining)`);

      // Use the updated method with better API handling
      const result = await this.createAutomatedPostWithToken(locationId, config, userToken.access_token);

      // If post was created successfully, update lastRun timestamp
      if (result) {
        console.log(`[AutomationScheduler] ✅ Post created successfully, updating lastRun timestamp`);

        // Mark the scheduled post as published (removes from scheduled section)
        scheduledPostsService.markAsPublished(locationId);

        // Update the lastRun time in settings
        if (this.settings.automations && this.settings.automations[locationId]) {
          if (!this.settings.automations[locationId].autoPosting) {
            this.settings.automations[locationId].autoPosting = {};
          }
          this.settings.automations[locationId].autoPosting.lastRun = new Date().toISOString();
          await this.updateAutomationSettings(locationId, this.settings.automations[locationId]);
          console.log(`[AutomationScheduler] ✅ lastRun updated in Supabase: ${this.settings.automations[locationId].autoPosting.lastRun}`);

          // If user hasn't customized time, reschedule to use the current post time for tomorrow
          // This ensures posts happen at the same time every day
          if (!this.settings.automations[locationId].autoPosting.userCustomizedTime) {
            console.log(`[AutomationScheduler] 🔄 User hasn't customized time - rescheduling to repeat at same time tomorrow`);
            this.stopAutoPosting(locationId);
            this.scheduleAutoPosting(locationId, this.settings.automations[locationId].autoPosting);
          }
        }
      }

      // Release the posting-in-progress lock
      this.postingInProgress.delete(locationId);
      return result;

    } catch (error) {
      console.error(`[AutomationScheduler] ❌ Error creating automated post:`, error);
      console.error(`[AutomationScheduler] Error stack:`, error.stack);

      // Mark the scheduled post as failed
      scheduledPostsService.markAsFailed(locationId, error.message);

      // Log the error
      const targetUserId = config?.userId || config?.autoPosting?.userId || 'system';
      this.logAutomationActivity(locationId, 'post_failed', {
        userId: targetUserId,
        error: error.message,
        timestamp: new Date().toISOString(),
        reason: 'system_error',
        errorStack: error.stack
      });

      // Release the posting-in-progress lock on error
      this.postingInProgress.delete(locationId);
      return null;
    }
  }

  /**
   * Trigger an immediate post for a location (used by "Today" frequency option)
   * This bypasses the cron scheduler and posts immediately
   */
  async triggerImmediatePost(locationId, userEmail, businessName) {
    console.log(`[AutomationScheduler] ⚡ IMMEDIATE POST triggered for ${businessName} (${locationId})`);

    try {
      // Build config from settings or create minimal config
      let config = this.settings.automations?.[locationId]?.autoPosting || {};

      // Ensure we have required fields
      config = {
        ...config,
        businessName: config.businessName || businessName || 'Business',
        userId: config.userId || config.email || userEmail,
        email: config.email || userEmail,
        enabled: true,
        frequency: 'daily', // For immediate post, treat as daily
        schedule: new Date().toTimeString().slice(0, 5) // Current time
      };

      console.log(`[AutomationScheduler] ⚡ Immediate post config:`, {
        locationId,
        businessName: config.businessName,
        userId: config.userId
      });

      // Call the existing createAutomatedPost method
      const result = await this.createAutomatedPost(locationId, config);

      if (result) {
        console.log(`[AutomationScheduler] ✅ Immediate post SUCCESS for ${businessName}`);
      } else {
        console.log(`[AutomationScheduler] ⚠️ Immediate post returned null for ${businessName} (may be blocked by duplicate prevention)`);
      }

      return result;
    } catch (error) {
      console.error(`[AutomationScheduler] ❌ Immediate post FAILED for ${businessName}:`, error.message);
      throw error;
    }
  }

  // Smart button type selection based on business category
  // CRITICAL: ALWAYS return 'call_now' as default for auto-posting
  // Google API automatically uses the business phone from profile
  smartSelectButtonType(category, phoneNumber, websiteUrl) {
    // ALWAYS return CALL_NOW for all auto-posting
    // This ensures every automated post has a Call Now button
    console.log('[AutomationScheduler] 🎯 Smart selection: ALWAYS using CALL_NOW button for auto-posting');
    return 'call_now';
  }

  // Generate call-to-action based on button configuration
  generateCallToAction(config) {
    const button = config.button;
    const phoneNumber = config.phoneNumber;
    const websiteUrl = config.websiteUrl;
    const category = config.businessCategory || config.category || '';

    console.log('[AutomationScheduler] ========================================');
    console.log('[AutomationScheduler] 🔘 CTA BUTTON GENERATION');
    console.log('[AutomationScheduler] Config received:', {
      hasButton: !!button,
      buttonEnabled: button?.enabled,
      buttonType: button?.type,
      buttonPhoneNumber: button?.phoneNumber,
      profilePhoneNumber: phoneNumber,
      customUrl: button?.customUrl,
      websiteUrl: websiteUrl,
      category: category,
      businessCategory: config.businessCategory
    });

    // 🔧 CRITICAL FIX: For auto-posting, ALWAYS add CALL button even if disabled
    // This ensures every automated post has a CTA button
    // Only skip if explicitly set to 'none' AND enabled is explicitly false
    if (button?.enabled === false && button?.type === 'none') {
      console.log('[AutomationScheduler] ⚠️ CTA button explicitly disabled with type "none"');
      console.log('[AutomationScheduler] 🔧 OVERRIDE: Auto-posting requires CTA - forcing CALL button');
      // Don't return null - force CALL button below
    }

    // Smart default button selection based on business category if no button specified
    let buttonType = button?.type;
    if (!buttonType || buttonType === 'none' || buttonType === 'auto') {
      buttonType = this.smartSelectButtonType(category, phoneNumber, websiteUrl);
      console.log(`[AutomationScheduler] 🎯 Smart-selected button type: ${buttonType} (always CALL for auto-posting)`);
    } else {
      console.log(`[AutomationScheduler] ✅ Using configured button type: ${buttonType}`);
    }

    // Handle different button types
    let actionType = 'CALL'; // Default to CALL button
    let url = button?.customUrl || websiteUrl || '';

    switch (buttonType) {
      case 'call_now':
        // 🔧 CRITICAL FIX: ALWAYS return CALL button for auto-posting
        // Google My Business API v4 automatically uses the phone number from the business profile
        // We don't need to pass the phone number in the CTA object
        const phone = button?.phoneNumber || phoneNumber;
        console.log('[AutomationScheduler] 📞 Call Now button - Phone numbers:', {
          fromButton: button?.phoneNumber || 'NONE',
          fromProfile: phoneNumber || 'NONE',
          finalPhone: phone || 'NONE (will use business profile phone)'
        });

        // ALWAYS return CALL CTA - Google API will use phone from business profile
        const callCTA = {
          actionType: 'CALL'
        };
        console.log('[AutomationScheduler] ✅ Generated CALL CTA:', callCTA);
        console.log('[AutomationScheduler] 📞 Phone number will be automatically used from business profile');
        console.log('[AutomationScheduler] ========================================');
        return callCTA;

      case 'book':
        actionType = 'BOOK';
        break;

      case 'order':
        actionType = 'ORDER';
        break;

      case 'buy':
        actionType = 'SHOP';
        break;

      case 'learn_more':
        actionType = 'LEARN_MORE';
        break;

      case 'sign_up':
        actionType = 'SIGN_UP';
        break;

      case 'auto':
        // CRITICAL: Auto mode now ALWAYS uses CALL button
        // This ensures all automated posts have a Call Now CTA
        actionType = 'CALL';
        console.log(`[AutomationScheduler] Auto-selected CTA type: ${actionType} (CALL is now the default for all auto-posting)`);
        console.log('[AutomationScheduler] ✅ Generated CALL CTA for auto mode');
        console.log('[AutomationScheduler] 📞 Phone number will be automatically used from business profile');
        console.log('[AutomationScheduler] ========================================');
        return { actionType: 'CALL' };
    }

    // For non-CALL actions, we need a URL
    if (!url && actionType !== 'CALL') {
      console.error(`[AutomationScheduler] ❌ ${actionType} button selected but no URL provided`);
      console.log('[AutomationScheduler] ========================================');
      return null;
    }

    const generatedCTA = {
      actionType: actionType,
      url: url
    };
    console.log('[AutomationScheduler] ✅ Generated CTA:', generatedCTA);
    console.log('[AutomationScheduler] ========================================');
    return generatedCTA;
  }

  // Fetch location details from Google API if address is missing
  async fetchLocationAddress(locationId, userId) {
    try {
      const token = await this.getValidTokenForUser(userId);
      if (!token || !token.access_token) {
        console.log('[AutomationScheduler] ⚠️ No valid token available to fetch location address');
        return null;
      }

      const HARDCODED_ACCOUNT_ID = process.env.HARDCODED_ACCOUNT_ID || '102242055729678854724';

      // Try Google My Business API v4 first (same format as posting API)
      console.log('[AutomationScheduler] 📍 Fetching location address from Google API...');
      const v4Url = `https://mybusiness.googleapis.com/v4/accounts/${HARDCODED_ACCOUNT_ID}/locations/${locationId}`;

      let response = await fetch(v4Url, {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[AutomationScheduler] 📍 Location data received:', JSON.stringify(data, null, 2).substring(0, 500));

        // Parse address from v4 API response
        if (data.address || data.storefrontAddress) {
          const addr = data.address || data.storefrontAddress;
          const result = {
            fullAddress: addr.addressLines?.join(', ') || addr.address || '',
            city: addr.locality || addr.city || '',
            region: addr.administrativeArea || addr.region || addr.state || '',
            country: addr.regionCode || addr.country || 'India',
            postalCode: addr.postalCode || '',
            // IMPORTANT: Include the real business name from Google
            businessName: data.locationName || data.title || null
          };
          console.log('[AutomationScheduler] ✅ Parsed address with business name:', result);
          return result;
        }

        // Try alternate field names
        if (data.locationName || data.title) {
          console.log('[AutomationScheduler] 📍 Using location name as fallback:', data.locationName || data.title);
          return {
            fullAddress: data.locationName || data.title || '',
            city: '',
            region: '',
            country: 'India',
            postalCode: '',
            businessName: data.locationName || data.title || null
          };
        }
      } else {
        const errorText = await response.text();
        console.log('[AutomationScheduler] ⚠️ V4 API failed:', response.status, errorText.substring(0, 200));
      }

      // Try Business Information API v1 as fallback
      console.log('[AutomationScheduler] 📍 Trying Business Information API v1...');
      const v1Url = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?readMask=storefrontAddress,title,name`;

      response = await fetch(v1Url, {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[AutomationScheduler] 📍 V1 Location data:', JSON.stringify(data, null, 2).substring(0, 500));

        if (data.storefrontAddress || data.title) {
          return {
            fullAddress: data.storefrontAddress?.addressLines?.join(', ') || '',
            city: data.storefrontAddress?.locality || '',
            region: data.storefrontAddress?.administrativeArea || '',
            country: data.storefrontAddress?.regionCode || 'India',
            postalCode: data.storefrontAddress?.postalCode || '',
            // IMPORTANT: Include the real business name from Google
            businessName: data.title || null
          };
        }
      }

      console.log('[AutomationScheduler] ⚠️ Could not fetch location address from Google API');
      return null;
    } catch (error) {
      console.log('[AutomationScheduler] Error fetching location address:', error.message);
      return null;
    }
  }

  // Generate post content using AI ONLY - no templates/mocks
  async generatePostContent(config, locationId, userId) {
    console.log(`[AutomationScheduler] ========================================`);
    console.log(`[AutomationScheduler] 📝 GENERATING POST CONTENT`);
    console.log(`[AutomationScheduler] Config received:`, JSON.stringify(config, null, 2));

    // Ensure we have proper business name and details
    let businessName = config.businessName || 'Business';
    const category = config.category || 'service';
    const keywords = config.keywords || 'quality, service, professional';
    let city = config.city || config.locationName || '';
    let region = config.region || '';
    let country = config.country || '';
    let fullAddress = config.fullAddress || '';
    const websiteUrl = config.websiteUrl || '';
    let postalCode = config.postalCode || config.pinCode || '';

    console.log(`[AutomationScheduler] 📍 INITIAL DATA FROM CONFIG:`);
    console.log(`   - businessName: "${businessName}"`);
    console.log(`   - city: "${city}"`);
    console.log(`   - region: "${region}"`);
    console.log(`   - country: "${country}"`);
    console.log(`   - fullAddress: "${fullAddress}"`);
    console.log(`   - postalCode: "${postalCode}"`);

    // Check if businessName looks like a location ID (starts with "locations/" or is just numbers)
    const needsRealBusinessName = !businessName ||
      businessName.startsWith('locations/') ||
      /^\d+$/.test(businessName) ||
      businessName === 'Business';

    // If address is missing OR business name needs to be fetched, get from Google API
    if (((!fullAddress || !city) || needsRealBusinessName) && locationId && userId) {
      console.log('[AutomationScheduler] 📍 Fetching location data from Google API...');
      if (needsRealBusinessName) {
        console.log('[AutomationScheduler] 📍 Business name needs update (current: "' + businessName + '")');
      }

      const addressData = await this.fetchLocationAddress(locationId, userId);
      if (addressData) {
        // CRITICAL: Update business name if we got the real one from Google
        if (needsRealBusinessName && addressData.businessName) {
          businessName = addressData.businessName;
          console.log('[AutomationScheduler] ✅ Got REAL business name from Google: "' + businessName + '"');
        }

        // Only update address if we got better data
        if (!fullAddress && addressData.fullAddress) {
          fullAddress = addressData.fullAddress;
        }
        if (!city && addressData.city) {
          city = addressData.city;
        }
        if (!region && addressData.region) {
          region = addressData.region;
        }
        if (!country && addressData.country) {
          country = addressData.country;
        }
        if (!postalCode && addressData.postalCode) {
          postalCode = addressData.postalCode;
        }
        console.log('[AutomationScheduler] ✅ Data after API fetch:', {
          businessName, fullAddress, city, region, country, postalCode
        });
      }
    }

    // Build location string prioritizing city
    let locationStr = city;
    if (region && !locationStr.includes(region)) {
      locationStr = locationStr ? `${locationStr}, ${region}` : region;
    }
    if (!locationStr && fullAddress) {
      locationStr = fullAddress;
    }

    // Build complete address for the footer - THIS IS CRITICAL FOR THE ADDRESS LINE
    let completeAddress = '';

    // Priority 1: Use fullAddress if available
    if (fullAddress) {
      completeAddress = fullAddress;
      // Add region if not already included
      if (region && !completeAddress.toLowerCase().includes(region.toLowerCase())) {
        completeAddress += `, ${region}`;
      }
    }
    // Priority 2: Build from city and region
    else if (city) {
      completeAddress = city;
      if (region && !completeAddress.toLowerCase().includes(region.toLowerCase())) {
        completeAddress += `, ${region}`;
      }
    }
    // Priority 3: Try to build from locationName in config
    else if (config.locationName) {
      completeAddress = config.locationName;
      if (region) {
        completeAddress += `, ${region}`;
      }
    }

    // Add postal code if we have it and it's not already included
    if (postalCode && completeAddress && !completeAddress.includes(postalCode)) {
      completeAddress += ` ${postalCode}`;
    }

    // Add country if we have it and it's not already included (only for India)
    if (country && completeAddress && !completeAddress.toLowerCase().includes('india') && country.toLowerCase() === 'india') {
      completeAddress += `, India`;
    }

    console.log(`[AutomationScheduler] 📍 FINAL COMPLETE ADDRESS: "${completeAddress}"`)

    console.log(`[AutomationScheduler] ========================================`);
    console.log(`[AutomationScheduler] 🎯 POST GENERATION PARAMETERS`);
    console.log(`[AutomationScheduler] Business Name: ${businessName}`);
    console.log(`[AutomationScheduler] Category: ${category}`);
    console.log(`[AutomationScheduler] 🔑 KEYWORDS: ${keywords}`);
    console.log(`[AutomationScheduler] Location: ${locationStr}`);
    console.log(`[AutomationScheduler] Complete Address: ${completeAddress}`);
    console.log(`[AutomationScheduler] Website: ${websiteUrl}`);
    console.log(`[AutomationScheduler] ========================================`);

    if (!this.openaiApiKey || !this.openaiEndpoint) {
      throw new Error('[AutomationScheduler] OpenAI not configured - AI generation is required');
    }

    try {
      // Parse keywords if it's a string
      const keywordList = typeof keywords === 'string'
        ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
        : keywords;

      // Generate unique content every time
      const randomSeed = Math.random();
      const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

      // Get business category from config and fetch category-specific guidelines
      const businessCategory = config.businessCategory || category;
      const categoryMapping = getCategoryMapping(businessCategory);

      console.log(`[AutomationScheduler] 📋 Business Category: ${businessCategory}`);
      console.log(`[AutomationScheduler] 🎯 Category Focus Areas: ${categoryMapping.focusAreas.join(', ')}`);

      // Build category-specific context
      const categoryContext = `
BUSINESS CATEGORY: ${businessCategory}

CATEGORY-SPECIFIC WRITING GUIDELINES:
- Focus on these aspects: ${categoryMapping.focusAreas.join(', ')}
- Use natural industry language like: ${categoryMapping.commonPhrases.slice(0, 6).join(', ')}
- Mention specific details such as: ${categoryMapping.specificAspects.slice(0, 6).join(', ')}
- Frame from customer perspective: ${categoryMapping.customerExperiences.slice(0, 3).join(', ')}`;

      const prompt = `Create a natural, engaging, HUMAN-LIKE Google Business Profile post for ${businessName}, a ${businessCategory}${locationStr ? ` in ${locationStr}` : ''}.

BUSINESS DETAILS:
- Business Name: ${businessName}
- Business Type: ${businessCategory}
- Location: ${locationStr || 'local area'}
- Complete Address: ${completeAddress}
- Keywords to include: ${Array.isArray(keywordList) ? keywordList.join(', ') : keywordList}
${websiteUrl ? `- Website: ${websiteUrl}` : ''}

${categoryContext}

CRITICAL WRITING RULES - MUST FOLLOW ALL:
1. Write MAXIMUM 100 words for the main content (not including address line) - KEEP IT SHORT AND CONCISE!
2. MUST feel like it was written by a human - warm, engaging, conversational tone
3. MUST mention the exact business name "${businessName}" naturally in the content
4. MUST incorporate AT LEAST 2 business keywords naturally: ${Array.isArray(keywordList) ? keywordList.slice(0, 2).join(', ') : keywordList}
5. MUST mention city/area name within the content naturally: ${locationStr}
6. Talk about the LOCAL AREA - nearby attractions, local landmarks, what makes this location special (BRIEFLY!)
7. Mention NATURE and WEATHER if relevant (beaches, mountains, deserts) - keep it SHORT
8. Highlight the business's SPECIAL QUALITIES that make it unique
9. Write in a storytelling style but KEEP IT BRIEF - make readers FEEL the experience in FEW words
10. Use category-specific language that sounds authentic to the industry
11. Be concise and impactful - every word counts!
12. ⚠️ NEVER use markdown formatting like **bold**, *italic*, __underline__, or \`code\` - write plain text only!

FORMAT REQUIREMENTS:
13. Use bullet points (•) or emojis to break up text and improve readability - but NO markdown!
14. ⚠️ CRITICAL: ALWAYS end with the address line in EXACTLY this format:

[Main post content here - MAXIMUM 100 words, human-like, brief local focus]

📍 Address: ${completeAddress}

14. The address line is MANDATORY and must be on a separate line with two line breaks before it
15. DO NOT include the address anywhere else in the post - only at the very end in the specified format

EXAMPLES OF GOOD SHORT POSTS (around 80-100 words):
- "Bikaner Desert Camp & Resort style experiences in Sam, Jaisalmer. NK Desert Camp & Resort offers luxury tents, desert safaris, and cultural evenings in golden dunes. • Luxury tent accommodations • Desert safari Jaisalmer • Evening cultural programs • Best desert camp. Discover ultimate desert adventure. 📍 Address: [address]"
- "Looking for Port Blair beach hotels? Kevin's Bed & Breakfast is near the beach with budget-friendly stay. 🌴 Perfect for beach lovers 🌴 Comfortable rooms 🌴 Easy access to attractions. Stay close to the sea. 📍 Address: [address]"

Write naturally, engagingly, but KEEP IT SHORT - maximum 100 words!`;

      const response = await fetch(
        this.openaiEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.openaiApiKey
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are a professional, creative social media content writer for Google Business Profiles who writes like a LOCAL EXPERT sharing their favorite places.

CRITICAL FORMATTING RULES:
1. Every post MUST be MAXIMUM 100 words (not including address line) - KEEP IT SHORT & PUNCHY!
2. Every post MUST end with "📍 Address: [complete address]" on a separate line after two line breaks
3. Write in a HUMAN, conversational tone - not robotic or corporate
4. Make readers FEEL the experience through vivid but BRIEF descriptions
5. Talk about the LOCAL AREA, nearby attractions, nature, weather - but KEEP IT CONCISE
6. Include category-specific language that sounds authentic to the industry
7. Use bullet points or emojis naturally to improve readability and save space
8. Incorporate business keywords naturally without forcing them
9. Write like you're recommending a place to a friend - warm, genuine, engaging, but BRIEF
10. Every word counts - be concise and impactful!

Think of yourself as writing a quick, enthusiastic recommendation - SHORT but memorable!`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 200,
            temperature: 0.9,
            frequency_penalty: 0.6,
            presence_penalty: 0.6,
            top_p: 0.95
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        let content = data.choices[0].message.content.trim();

        // CRITICAL: Remove markdown formatting - Google doesn't render it
        // Remove **bold** and *italic* markdown
        content = content.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove **bold**
        content = content.replace(/\*([^*]+)\*/g, '$1');     // Remove *italic*
        content = content.replace(/__([^_]+)__/g, '$1');     // Remove __bold__
        content = content.replace(/_([^_]+)_/g, '$1');       // Remove _italic_
        content = content.replace(/`([^`]+)`/g, '$1');       // Remove `code`
        content = content.replace(/#{1,6}\s/g, '');          // Remove # headers

        console.log(`[AutomationScheduler] ✅ Markdown formatting removed from AI content`);

        // Ensure the address line is properly added if not already present
        const addressLine = `📍 Address: ${completeAddress}`;
        if (completeAddress && !content.includes('📍 Address:') && !content.includes(completeAddress)) {
          // Add two line breaks and then the address
          content = content + '\n\n' + addressLine;
        }

        console.log(`[AutomationScheduler] AI generated unique content (${content.split(' ').length} words)`);
        console.log(`[AutomationScheduler] Final post content with address:`, content);

        // Generate callToAction based on button configuration
        const callToAction = this.generateCallToAction(config);

        return {
          content,
          callToAction
        };
      } else {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('[AutomationScheduler] Critical error - AI generation failed:', error);
      throw new Error(`AI content generation failed: ${error.message}. Please ensure OpenAI is properly configured.`);
    }
  }

  // Start monitoring reviews for auto-reply
  startReviewMonitoring(locationId, config) {
    if (this.reviewCheckIntervals.has(locationId)) {
      console.log(`[AutomationScheduler] Review monitoring already active for location ${locationId}`);
      return;
    }

    console.log(`[AutomationScheduler] Starting review monitoring for location ${locationId}`);
    console.log(`[AutomationScheduler] ⚡ Auto-reply is ACTIVE - will check and reply to new reviews every 2 minutes automatically`);

    // Check for new reviews every 2 minutes for faster response
    const interval = setInterval(async () => {
      console.log(`[AutomationScheduler] 🔍 Checking for new reviews to auto-reply...`);
      await this.checkAndReplyToReviews(locationId, config);
    }, 2 * 60 * 1000); // 2 minutes

    this.reviewCheckIntervals.set(locationId, interval);

    // Also run immediately
    console.log(`[AutomationScheduler] Running initial review check...`);
    this.checkAndReplyToReviews(locationId, config);
  }

  // Stop review monitoring
  stopReviewMonitoring(locationId) {
    const interval = this.reviewCheckIntervals.get(locationId);
    if (interval) {
      clearInterval(interval);
      this.reviewCheckIntervals.delete(locationId);
      console.log(`[AutomationScheduler] Stopped review monitoring for location ${locationId}`);
    }
  }

  // Check for new reviews and auto-reply
  async checkAndReplyToReviews(locationId, config) {
    try {
      console.log(`[AutomationScheduler] 🔍 Checking for new reviews to auto-reply for location ${locationId}`);

      // Get a valid token using the new token system
      const targetUserId = config.userId || 'default';
      console.log(`[AutomationScheduler] Getting valid token for user: ${targetUserId}`);

      // 🔒 SUBSCRIPTION CHECK - Verify user has valid trial or active subscription before replying
      const gbpAccountId = config.gbpAccountId || config.accountId;
      console.log(`[AutomationScheduler] 🔒 Validating subscription for user ${targetUserId}, GBP Account: ${gbpAccountId}`);

      const validationResult = await subscriptionGuard.validateBeforeAutomation(targetUserId, gbpAccountId, 'auto_reply');

      if (!validationResult.allowed) {
        console.error(`[AutomationScheduler] ❌ SUBSCRIPTION CHECK FAILED`);
        console.error(`[AutomationScheduler] Reason: ${validationResult.reason}`);
        console.error(`[AutomationScheduler] Message: ${validationResult.message}`);
        console.error(`[AutomationScheduler] 🚫 AUTO-REPLY BLOCKED - Trial/Subscription expired!`);

        // Log this blocked attempt
        this.logAutomationActivity(locationId, 'review_check_failed', {
          userId: targetUserId,
          error: validationResult.message,
          reason: validationResult.reason,
          timestamp: new Date().toISOString(),
          blockedBy: 'subscription_guard'
        });

        return null; // Stop - don't reply to reviews
      }

      console.log(`[AutomationScheduler] ✅ Subscription validated - ${validationResult.status} (${validationResult.daysRemaining} days remaining)`);

      let userToken = await this.getValidTokenForUser(targetUserId);

      if (!userToken) {
        // IMPROVED: Use shared token pool for better reliability
        console.log(`[AutomationScheduler] No token for ${targetUserId}, trying shared token pool...`);

        // Try the shared token pool first
        userToken = await supabaseTokenStorage.getAnyValidToken();

        if (userToken) {
          console.log(`[AutomationScheduler] ✅ Using token from pool for reviews (original user: ${userToken.poolUserId})`);
        } else {
          // Fallback: Try individual automation user tokens
          const userIds = this.getAutomationUserIds();
          if (userIds.length > 0) {
            for (const userId of userIds) {
              if (userId === targetUserId) continue;
              const validToken = await this.getValidTokenForUser(userId);
              if (validToken) {
                userToken = validToken;
                console.log(`[AutomationScheduler] ⚡ Using token from fallback user: ${userId} for reviews`);
                break;
              }
            }
          }
        }

        if (!userToken) {
          console.error(`[AutomationScheduler] ⚠️ No valid tokens available for reviews.`);
          console.log(`[AutomationScheduler] 💡 User needs to reconnect via Settings > Connections`);
          return null;
        }
      }

      // Get reviews from Google Business Profile API - try modern endpoint first
      let response;
      let reviews = [];

      // Use Google Business Profile API v4 (current version)
      const accountId = config.accountId || config.gbpAccountId || process.env.HARDCODED_ACCOUNT_ID || '102242055729678854724';
      console.log(`[AutomationScheduler] Fetching reviews using API v4 for location ${locationId}...`);
      response = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${userToken.access_token}`
          }
        }
      );

      if (!response.ok) {
        console.error(`[AutomationScheduler] ❌ Failed to fetch reviews:`, await response.text());
        return;
      }

      const data = await response.json();
      reviews = data.reviews || [];
      console.log(`[AutomationScheduler] ✅ Found ${reviews.length} reviews`);

      // Get list of already replied reviews
      const repliedReviews = this.getRepliedReviews(locationId);

      // Filter reviews that need replies - AUTOMATICALLY REPLY TO ALL NEW REVIEWS
      const unrepliedReviews = reviews.filter(review =>
        !review.reviewReply &&
        !review.reply &&
        !repliedReviews.includes(review.reviewId || review.name)
      );

      if (unrepliedReviews.length > 0) {
        console.log(`[AutomationScheduler] 🎯 Found ${unrepliedReviews.length} NEW REVIEWS that need automatic replies!`);
        console.log(`[AutomationScheduler] ⚡ AUTO-REPLYING NOW WITHOUT ANY MANUAL INTERVENTION...`);

        for (const review of unrepliedReviews) {
          const reviewerName = review.reviewer?.displayName || 'Unknown';

          // Convert rating string to number for display
          const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
          let rating = review.starRating?.value || review.starRating || 5;
          if (typeof rating === 'string') {
            rating = ratingMap[rating.toUpperCase()] || 5;
          }

          console.log(`[AutomationScheduler] 📝 Processing review from ${reviewerName} (${rating} stars)`);

          await this.replyToReview(locationId, review, config, userToken);

          // Add delay between replies to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log(`[AutomationScheduler] ✅ AUTO-REPLY COMPLETE! All new reviews have been replied to automatically.`);
      } else {
        console.log(`[AutomationScheduler] 📭 No new reviews found. All reviews already have replies.`);
      }
    } catch (error) {
      console.error(`[AutomationScheduler] ❌ Error checking reviews:`, error);

      // Log the error
      this.logAutomationActivity(locationId, 'review_check_failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Check if we should reply to a review based on configuration
  shouldReplyToReview(review, config) {
    // Convert rating string to number
    const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
    let rating = review.starRating?.value || review.starRating || 5;
    if (typeof rating === 'string') {
      rating = ratingMap[rating.toUpperCase()] || 5;
    }

    // Reply based on configuration
    if (config.replyToAll) return true;
    if (config.replyToPositive && rating >= 4) return true;
    if (config.replyToNegative && rating <= 2) return true;
    if (config.replyToNeutral && rating === 3) return true;

    return false;
  }

  // Reply to a single review
  async replyToReview(locationId, review, config, token) {
    try {
      const reviewId = review.reviewId || review.name;

      // Convert rating string to number for display
      const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
      let rating = review.starRating?.value || review.starRating || 5;
      if (typeof rating === 'string') {
        rating = ratingMap[rating.toUpperCase()] || 5;
      }

      const reviewerName = review.reviewer?.displayName || 'Unknown';

      console.log(`[AutomationScheduler] 🤖 AUTO-GENERATING AI REPLY for review ${reviewId}`);
      console.log(`[AutomationScheduler] 📊 Review details: ${rating} stars from ${reviewerName}`);

      // Generate reply using AI - FULLY AUTOMATIC
      const replyText = await this.generateReviewReply(review, config);
      console.log(`[AutomationScheduler] 💬 Generated reply: "${replyText.substring(0, 100)}..."`);

      // Send reply via Google Business Profile API - try modern endpoint first
      let success = false;

      // Use Google Business Profile API v4
      const accountId = config.accountId || config.gbpAccountId || process.env.HARDCODED_ACCOUNT_ID || '102242055729678854724';
      console.log(`[AutomationScheduler] Attempting to reply using API v4...`);
      const apiResponse = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            comment: replyText
          })
        }
      );

      if (apiResponse.ok) {
        console.log(`[AutomationScheduler] ✅ Successfully replied to review ${reviewId}`);
        success = true;
      } else {
        const error = await apiResponse.text();
        console.error(`[AutomationScheduler] ❌ Failed to reply to review:`, error);
      }

      if (success) {
        // Mark review as replied
        this.markReviewAsReplied(locationId, reviewId);

        // Log the activity
        this.logAutomationActivity(locationId, 'review_replied', {
          userId: config.userId || 'system',
          reviewId: reviewId,
          rating: rating,
          reviewerName: reviewerName,
          replyText,
          timestamp: new Date().toISOString()
        });

        console.log(`[AutomationScheduler] ✅ Review reply completed successfully!`);
      } else {
        // Log the failure
        this.logAutomationActivity(locationId, 'review_reply_failed', {
          userId: config.userId || 'system',
          reviewId: reviewId,
          rating: rating,
          reviewerName: reviewerName,
          error: 'API request failed',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`[AutomationScheduler] ❌ Error replying to review:`, error);

      // Log the error
      this.logAutomationActivity(locationId, 'review_reply_failed', {
        userId: config.userId || 'system',
        reviewId: review.reviewId || review.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Generate review reply using AI ONLY - no templates
  // Format: "Dear {Client Name}, [AI-generated content] Warm regards, Team {Business Name}"
  async generateReviewReply(review, config) {
    // Convert rating string to number
    const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
    let rating = review.starRating?.value || review.starRating || 5;

    // If rating is a string like "FIVE", convert to number
    if (typeof rating === 'string') {
      rating = ratingMap[rating.toUpperCase()] || 5;
    }

    const reviewText = review.comment || '';
    const reviewerName = review.reviewer?.displayName || 'valued customer';
    const category = config.category || 'business';

    // 🔧 FIX: Clean up businessName - it might be a location path like "locations/123456789"
    // instead of the actual business name. Also try to get it from autoPosting settings.
    let businessName = config.businessName || config.autoPosting?.businessName || 'our business';

    // If businessName looks like a location path (e.g., "locations/143639376938647655"),
    // try to get the real name from other sources or use a fallback
    if (businessName.startsWith('locations/') || businessName.match(/^[0-9]+$/)) {
      console.log(`[AutomationScheduler] ⚠️ businessName is a location ID: "${businessName}", looking for real name...`);

      // Try to get real business name from config.locationName or autoPosting.locationName
      const realName = config.locationName || config.autoPosting?.locationName ||
                       config.displayName || config.autoPosting?.displayName ||
                       config.title || config.autoPosting?.title;

      if (realName && !realName.startsWith('locations/') && !realName.match(/^[0-9]+$/)) {
        businessName = realName;
        console.log(`[AutomationScheduler] ✅ Found real business name: "${businessName}"`);
      } else {
        // Last resort: fetch from Supabase using locationId
        const locationId = businessName.replace('locations/', '') || config.locationId;
        try {
          const { data } = await supabaseAutomationService.client
            .from('user_locations')
            .select('business_name')
            .eq('location_id', locationId)
            .single();

          if (data?.business_name && !data.business_name.startsWith('locations/')) {
            businessName = data.business_name;
            console.log(`[AutomationScheduler] ✅ Fetched real business name from DB: "${businessName}"`);
          } else {
            businessName = 'our team';
            console.log(`[AutomationScheduler] ⚠️ Could not find real business name, using fallback: "${businessName}"`);
          }
        } catch (err) {
          businessName = 'our team';
          console.log(`[AutomationScheduler] ⚠️ Error fetching business name, using fallback: "${businessName}"`);
        }
      }
    }

    // 🔧 FIX: Get keywords from config OR from autoPosting settings
    const keywords = config.keywords || config.autoPosting?.keywords || '';

    if (!this.openaiApiKey || !this.openaiEndpoint) {
      throw new Error('[AutomationScheduler] OpenAI not configured - AI generation is required for review replies');
    }

    try {
      // Parse keywords if string
      const keywordList = typeof keywords === 'string'
        ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
        : Array.isArray(keywords) ? keywords : [];

      // Determine tone based on rating
      const tone = rating >= 4 ? 'grateful, warm, and enthusiastic' :
        rating <= 2 ? 'empathetic, apologetic, and solution-focused' :
          'appreciative, professional, and encouraging';

      // Add variety with random elements to ensure different content every time
      const randomSeed = Math.random();
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
      const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';

      const prompt = `Generate ONLY the middle content for a Google Business review reply for "${businessName}" (${category}).

Reviewer Name: ${reviewerName}
Rating: ${rating}/5 stars
Review Text: "${reviewText}"
Business Keywords: ${keywordList.length > 0 ? keywordList.join(', ') : 'quality service, customer satisfaction'}
Random Seed: ${randomSeed}
Time Context: ${timeOfDay}

CRITICAL FORMATTING REQUIREMENTS:
1. Generate ONLY the middle content paragraph - DO NOT include "Dear..." or "Warm regards..." or any greeting/closing
2. The content will be wrapped with:
   - Opening: "Dear ${reviewerName},"
   - Closing: "Warm regards, Team ${businessName}"
3. So you must write ONLY the middle content between these two parts

CONTENT Requirements:
1. Write EXACTLY 40-60 words for the middle content
2. Use a ${tone} tone
3. Reference something specific from their review
4. If positive (${rating >= 4}): thank them and highlight what we do well
5. If negative (${rating <= 2}): acknowledge concern, apologize sincerely, and offer solution
6. Make content DIFFERENT every time - vary vocabulary, sentence structure, focus points
7. Naturally incorporate business strengths/keywords if relevant
8. Be authentic and personalized to THIS specific review
9. DO NOT use generic phrases - make it specific to their experience

Return ONLY the middle content paragraph with no greeting or closing.`;

      const response = await fetch(
        this.openaiEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.openaiApiKey
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are a professional content writer for ${businessName}. Generate ONLY the middle content of a review reply. DO NOT include greetings like "Dear..." or closings like "Warm regards" - those will be added automatically. Write authentic, varied content that is different every time. Focus on making each response unique and personalized to the specific review.`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 200,
            temperature: 0.9, // Higher for more variation
            frequency_penalty: 0.8, // Prevent repetitive phrases
            presence_penalty: 0.6 // Encourage new topics/words
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        let middleContent = data.choices[0].message.content.trim();

        // Clean up any greeting/closing that AI might have added despite instructions
        middleContent = middleContent
          .replace(/^Dear\s+[^,]+,?\s*/i, '') // Remove "Dear..." if present
          .replace(/\s*(Warm regards|Best regards|Sincerely|Thank you|Thanks),?\s*Team\s+.*/i, '') // Remove closings
          .replace(/\s*(Warm regards|Best regards|Sincerely|Thank you|Thanks),?\s*$/i, '') // Remove standalone closings
          .trim();

        // Format the complete reply with proper structure
        const completeReply = `Dear ${reviewerName},

${middleContent}

Warm regards,
Team ${businessName}`;

        console.log(`[AutomationScheduler] ✅ AI generated personalized reply for ${reviewerName}`);
        console.log(`[AutomationScheduler] Reply format: "Dear ${reviewerName}, [${middleContent.split(' ').length} words] Warm regards, Team ${businessName}"`);

        return completeReply;
      } else {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('[AutomationScheduler] Critical error - AI reply generation failed:', error);
      throw new Error(`AI reply generation failed: ${error.message}. Please ensure OpenAI is properly configured.`);
    }
  }

  // Track replied reviews
  getRepliedReviews(locationId) {
    const repliedFile = path.join(__dirname, '..', 'data', `replied_reviews_${locationId}.json`);
    try {
      if (fs.existsSync(repliedFile)) {
        const data = JSON.parse(fs.readFileSync(repliedFile, 'utf8'));
        return data.repliedReviews || [];
      }
    } catch (error) {
      console.error('[AutomationScheduler] Error loading replied reviews:', error);
    }
    return [];
  }

  markReviewAsReplied(locationId, reviewId) {
    const repliedFile = path.join(__dirname, '..', 'data', `replied_reviews_${locationId}.json`);
    let data = { repliedReviews: [] };

    try {
      if (fs.existsSync(repliedFile)) {
        data = JSON.parse(fs.readFileSync(repliedFile, 'utf8'));
      }

      if (!data.repliedReviews.includes(reviewId)) {
        data.repliedReviews.push(reviewId);
        fs.writeFileSync(repliedFile, JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('[AutomationScheduler] Error marking review as replied:', error);
    }
  }

  // Log automation activities to Supabase
  async logAutomationActivity(locationId, type, details) {
    try {
      const userId = details.userId || 'system';
      const reviewId = details.reviewId || null;

      // Determine status based on type
      let status = 'success';
      let errorMessage = null;

      if (type.includes('failed')) {
        status = 'failed';
        errorMessage = details.error || 'Unknown error';
      }

      // Map old type names to action_type for database
      let actionType = type;
      if (type === 'post_created') actionType = 'post_created';
      if (type === 'post_failed') actionType = 'post_failed';
      if (type === 'review_replied') actionType = 'review_replied';
      if (type === 'reply_failed') actionType = 'reply_failed';

      // Log to Supabase instead of JSON file
      await supabaseAutomationService.logActivity(
        userId,
        locationId,
        actionType,
        reviewId,
        status,
        details,
        errorMessage
      );

      console.log(`[AutomationScheduler] ✅ Logged activity: ${actionType} for location ${locationId}`);
    } catch (error) {
      console.error('[AutomationScheduler] Error logging activity to Supabase:', error);
      // Don't throw error - logging failure shouldn't stop automation
    }
  }

  // Get unique user IDs from all automation settings
  getAutomationUserIds() {
    const userIds = new Set();
    const automations = this.settings.automations || {};

    for (const [locationId, config] of Object.entries(automations)) {
      if (config.autoPosting?.userId) {
        userIds.add(config.autoPosting.userId);
      }
      if (config.autoReply?.userId) {
        userIds.add(config.autoReply.userId);
      }
      if (config.userId) {
        userIds.add(config.userId);
      }
    }

    // Remove 'default' as it's not a real user
    userIds.delete('default');

    return Array.from(userIds);
  }

  // Get automation status for a location
  getAutomationStatus(locationId) {
    const settings = this.settings.automations?.[locationId] || {};
    return {
      autoPosting: {
        enabled: settings.autoPosting?.enabled || false,
        schedule: settings.autoPosting?.schedule || null,
        frequency: settings.autoPosting?.frequency || null,
        lastRun: settings.autoPosting?.lastRun || null,
        isRunning: this.scheduledJobs.has(locationId)
      },
      autoReply: {
        enabled: settings.autoReply?.enabled || false,
        lastCheck: settings.autoReply?.lastCheck || null,
        isRunning: this.reviewCheckIntervals.has(locationId)
      }
    };
  }

  // Stop all automations
  stopAllAutomations() {
    console.log('[AutomationScheduler] Stopping all automations...');

    // Stop all scheduled posts
    for (const [locationId, job] of this.scheduledJobs) {
      job.stop();
    }
    this.scheduledJobs.clear();

    // Stop all review monitors
    for (const [locationId, interval] of this.reviewCheckIntervals) {
      clearInterval(interval);
    }
    this.reviewCheckIntervals.clear();

    // Stop the missed post checker
    if (this.missedPostCheckerInterval) {
      clearInterval(this.missedPostCheckerInterval);
      this.missedPostCheckerInterval = null;
      console.log('[AutomationScheduler] Stopped missed post checker');
    }

    console.log('[AutomationScheduler] All automations stopped');
  }
}

// Create singleton instance
const automationScheduler = new AutomationScheduler();

// NO automatic initialization here - server.js will call initializeAutomations() after startup
// This allows proper async loading from Supabase

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[AutomationScheduler] Shutting down gracefully...');
  automationScheduler.stopAllAutomations();
  process.exit(0);
});

export default automationScheduler;
import cron from 'node-cron';
import fetch from 'node-fetch';
import supabaseTokenStorage from './supabaseTokenStorage.js';
import supabaseAutomationService from './supabaseAutomationService.js';

class AutomationScheduler {
  constructor() {
    // REMOVED: JSON file storage - now using Supabase only
    this.settings = { automations: {} }; // In-memory cache, loaded from Supabase
    this.scheduledJobs = new Map();
    this.reviewCheckIntervals = new Map();

    // Post creation locks to prevent duplicate posts (fixes 3 posts at same time issue)
    this.postCreationLocks = new Map(); // locationId -> timestamp of last post creation
    this.DUPLICATE_POST_WINDOW = 60 * 1000; // 60 seconds - prevent duplicate posts within this window

    // Hardcoded Azure OpenAI configuration - no environment variables needed
    this.azureEndpoint = 'https://agentplus.openai.azure.com/';
    this.apiKey = '1TPW16ifwPJccSiQPSHq63nU7IcT6R9DrduIHBYwCm5jbUWiSbkLJQQJ99BDACYeBjFXJ3w3AAABACOG3Yia';
    this.deploymentName = 'gpt-4o';
    this.apiVersion = '2024-02-15-preview';

    // Log Azure OpenAI configuration status
    console.log('[AutomationScheduler] ✅ Azure OpenAI Configuration (Hardcoded):');
    console.log(`  - Endpoint: ✅ ${this.azureEndpoint}`);
    console.log(`  - API Key: ✅ Configured`);
    console.log(`  - Deployment: ✅ ${this.deploymentName}`);
    console.log(`  - API Version: ✅ ${this.apiVersion}`);
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

        console.log(`[AutomationScheduler] ✅ Loaded settings for location ${locationId}:`, {
          hasAutoPosting: !!setting?.autoPosting,
          autoPostingEnabled: setting?.autoPosting?.enabled,
          hasAutoReply: !!setting?.autoReply,
          autoReplyEnabled: setting?.autoReply?.enabled
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

    // Load settings from Supabase first
    await this.loadSettings();

    const automations = this.settings.automations || {};
    for (const [locationId, config] of Object.entries(automations)) {
      if (config.autoPosting?.enabled) {
        this.scheduleAutoPosting(locationId, config.autoPosting);
      }
      if (config.autoReply?.enabled) {
        this.startReviewMonitoring(locationId, config.autoReply);
      }
    }

    console.log(`[AutomationScheduler] ✅ Initialized ${this.scheduledJobs.size} posting schedules and ${this.reviewCheckIntervals.size} review monitors`);

    // Start catch-up mechanism to handle missed posts
    this.startMissedPostChecker();

    // Check for missed posts immediately on startup
    console.log('[AutomationScheduler] Running initial check for missed posts...');
    this.checkAndCreateMissedPosts();
  }

  // Start a background checker for missed posts (runs every 2 minutes for more reliability)
  startMissedPostChecker() {
    if (this.missedPostCheckerInterval) {
      clearInterval(this.missedPostCheckerInterval);
    }

    console.log('[AutomationScheduler] ⏰ Starting missed post checker (every 2 minutes)');

    // Check every 2 minutes for any posts that should have been created
    this.missedPostCheckerInterval = setInterval(async () => {
      console.log('[AutomationScheduler] 🔍 Running periodic check for missed posts...');
      await this.checkAndCreateMissedPosts();
    }, 2 * 60 * 1000); // 2 minutes for more reliable posting
  }

  // Check for missed posts and create them
  async checkAndCreateMissedPosts() {
    try {
      const automations = this.settings.automations || {};
      const now = new Date();

      console.log(`[AutomationScheduler] 📅 Checking ${Object.keys(automations).length} locations for missed posts at ${now.toISOString()}`);

      for (const [locationId, config] of Object.entries(automations)) {
        if (!config.autoPosting?.enabled) {
          continue;
        }

        const autoPosting = config.autoPosting;
        const lastRun = autoPosting.lastRun ? new Date(autoPosting.lastRun) : null;

        // Calculate when the next post should be created based on schedule
        const nextScheduledTime = this.calculateNextScheduledTime(autoPosting, lastRun);

        if (!nextScheduledTime) {
          console.log(`[AutomationScheduler] ⏭️  Skipping ${locationId} - no schedule configured`);
          continue;
        }

        console.log(`[AutomationScheduler] 📊 Location ${locationId}:`);
        console.log(`  - Last run: ${lastRun ? lastRun.toISOString() : 'NEVER'}`);
        console.log(`  - Next scheduled: ${nextScheduledTime.toISOString()}`);
        console.log(`  - Current time: ${now.toISOString()}`);
        console.log(`  - Is overdue: ${now >= nextScheduledTime}`);

        // If we're past the scheduled time and haven't run yet, create the post
        if (now >= nextScheduledTime) {
          console.log(`[AutomationScheduler] ⚡ MISSED POST CHECKER TRIGGERED for ${locationId}! Creating now...`);
          console.log(`  - Business: ${autoPosting.businessName}`);
          console.log(`  - Frequency: ${autoPosting.frequency}`);
          console.log(`  - Schedule: ${autoPosting.schedule}`);
          console.log(`  - 🕐 Checker time: ${new Date().toISOString()}`);

          // Create the post (will be prevented by lock if duplicate)
          await this.createAutomatedPost(locationId, autoPosting);

          // Update last run time in cache AND Supabase
          this.settings.automations[locationId].autoPosting.lastRun = now.toISOString();
          await this.updateAutomationSettings(locationId, this.settings.automations[locationId]);

          console.log(`[AutomationScheduler] ✅ Missed post created and lastRun updated for ${locationId}`);
        }
      }
    } catch (error) {
      console.error('[AutomationScheduler] ❌ Error checking missed posts:', error);
    }
  }

  // Calculate the next scheduled time based on frequency and last run
  calculateNextScheduledTime(config, lastRun) {
    if (!config.schedule || !config.frequency) {
      return null;
    }

    const [hour, minute] = config.schedule.split(':').map(Number);

    // If never run before, schedule for today (or tomorrow if time has passed)
    if (!lastRun) {
      const today = new Date();
      today.setHours(hour, minute, 0, 0);

      // If scheduled time today has passed, start from tomorrow
      if (today < new Date()) {
        return today;
      } else {
        today.setDate(today.getDate() + 1);
        return today;
      }
    }

    // Calculate next run based on frequency
    const nextRun = new Date(lastRun);
    nextRun.setHours(hour, minute, 0, 0);

    switch (config.frequency) {
      case 'daily':
        // Next day at scheduled time
        nextRun.setDate(nextRun.getDate() + 1);
        break;

      case 'alternative':
        // Every 2 days
        nextRun.setDate(nextRun.getDate() + 2);
        break;

      case 'weekly':
        // Next week same day
        nextRun.setDate(nextRun.getDate() + 7);
        break;

      case 'twice-weekly':
        // Next occurrence (3 or 4 days based on current day)
        const currentDay = nextRun.getDay();
        if (currentDay === 1) { // Monday -> Thursday
          nextRun.setDate(nextRun.getDate() + 3);
        } else { // Thursday -> Monday
          nextRun.setDate(nextRun.getDate() + 4);
        }
        break;

      case 'test30s':
        // Every 30 seconds
        nextRun.setSeconds(nextRun.getSeconds() + 30);
        break;

      default:
        return null;
    }

    return nextRun;
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
          enabled: settings.autoPosting?.enabled || settings.autoReply?.enabled || false,
          autoReplyEnabled: settings.autoReply?.enabled || false
        });
        console.log(`[AutomationScheduler] ✅ Settings saved to Supabase for location ${locationId}`);
      }
    } catch (error) {
      console.error('[AutomationScheduler] ❌ Error saving to Supabase:', error);
    }

    // Restart relevant automations
    if (settings.autoPosting !== undefined) {
      this.stopAutoPosting(locationId);
      if (settings.autoPosting?.enabled) {
        this.scheduleAutoPosting(locationId, settings.autoPosting);
      }
    }

    if (settings.autoReply !== undefined) {
      this.stopReviewMonitoring(locationId);
      if (settings.autoReply?.enabled) {
        this.startReviewMonitoring(locationId, settings.autoReply);
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

    let cronExpression;
    const [hour, minute] = config.schedule.split(':');

    switch (config.frequency) {
      case 'daily':
        // Daily at specified time (e.g., "09:00")
        cronExpression = `${minute} ${hour} * * *`;
        break;
      case 'alternative':
        // For "alternative" (every 2 days), run daily at scheduled time
        // The createAutomatedPost method will check lastRun and only post if 2 days have passed
        cronExpression = `${minute} ${hour} * * *`;
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
    console.log(`[AutomationScheduler] 📅 Frequency: ${config.frequency}, Schedule: ${config.schedule}, Timezone: ${config.timezone || 'America/New_York'}`);

    const job = cron.schedule(cronExpression, async () => {
      console.log(`[AutomationScheduler] ⏰ CRON TRIGGERED - Running scheduled post for location ${locationId}`);
      console.log(`[AutomationScheduler] 🕐 Trigger time: ${new Date().toISOString()}`);
      
      // For frequencies that need interval checking (like "alternative"), verify it's time to post
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
      
      await this.createAutomatedPost(locationId, config);
    }, {
      scheduled: true,
      timezone: config.timezone || 'America/New_York'
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

      // Generate post content using AI
      const postContent = await this.generatePostContent(config, locationId, config.userId);
      
      // Create the post via Google Business Profile API (v4 - current version)
      // v4 requires accountId in the path
      const accountId = config.accountId || '106433552101751461082';
      const postUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
      console.log(`[AutomationScheduler] Posting to URL: ${postUrl}`);
      
      const postData = {
        languageCode: 'en',
        summary: postContent.content,
        topicType: config.topicType || 'STANDARD'
      };

      // Add call to action if generated
      if (postContent.callToAction) {
        console.log('[AutomationScheduler] Adding CTA to post:', postContent.callToAction);
        postData.callToAction = postContent.callToAction;
      } else {
        console.log('[AutomationScheduler] No CTA to add to post');
      }

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

        // Log the post creation
        this.logAutomationActivity(locationId, 'post_created', {
          userId: config.userId || 'system',
          postId: result.name || result.id,
          content: postContent.content,
          timestamp: new Date().toISOString()
        });

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
        return await this.createPostWithFallbackAPI(locationId, postContent, accessToken, config);
      }
    } catch (error) {
      console.error(`[AutomationScheduler] Error creating automated post:`, error);
      return null; // Return null to indicate failure
    }
  }

  // Fallback method for post creation using alternative API
  async createPostWithFallbackAPI(locationId, postContent, accessToken, config) {
    try {
      // Use Google My Business API v4 as fallback
      const accountId = config.accountId || '106433552101751461082';
      const fallbackUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
      
      console.log(`[AutomationScheduler] Using fallback API: ${fallbackUrl}`);
      
      const fallbackPostData = {
        languageCode: 'en',
        summary: postContent.content,
        topicType: config.topicType || 'STANDARD'
      };

      // Add call to action if available
      if (postContent.callToAction) {
        fallbackPostData.callToAction = postContent.callToAction;
      }

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
          return null; // Exit early - don't create duplicate post
        }
      }

      // Set lock IMMEDIATELY to prevent race conditions
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
        // Try to find any available token from storage
        console.log(`[AutomationScheduler] ❌ No token found for ${targetUserId}`);
        console.log(`[AutomationScheduler] 🔍 Checking all available tokens in legacy storage...`);
        const tokens = this.loadTokens();
        const tokenKeys = Object.keys(tokens);

        console.log(`[AutomationScheduler] Legacy storage contains ${tokenKeys.length} user(s):`, tokenKeys);

        if (tokenKeys.length > 0) {
          console.log(`[AutomationScheduler] Found tokens for users: ${tokenKeys.join(', ')}`);

          // Try each available token
          for (const userId of tokenKeys) {
            console.log(`[AutomationScheduler] 🔄 Trying to get valid token for fallback user: ${userId}`);
            const validToken = await this.getValidTokenForUser(userId);
            if (validToken) {
              userToken = validToken;
              console.log(`[AutomationScheduler] ✅ Using valid token from fallback user: ${userId}`);
              break;
            } else {
              console.log(`[AutomationScheduler] ❌ Token for fallback user ${userId} is invalid or expired`);
            }
          }
        } else {
          console.log(`[AutomationScheduler] ❌ No tokens found in legacy storage`);
        }

        if (!userToken) {
          console.error(`[AutomationScheduler] ========================================`);
          console.error(`[AutomationScheduler] ❌ CRITICAL: No valid tokens available!`);
          console.error(`[AutomationScheduler] 💡 SOLUTION: User needs to reconnect to Google Business Profile.`);
          console.error(`[AutomationScheduler] 💡 Go to: Settings > Connections > Connect Google Business Profile`);
          console.error(`[AutomationScheduler] 💡 Target User ID: ${targetUserId}`);
          console.error(`[AutomationScheduler] ========================================`);

          // Log this as a failed attempt
          this.logAutomationActivity(locationId, 'post_failed', {
            error: 'No valid tokens available',
            timestamp: new Date().toISOString(),
            reason: 'authentication_required',
            userId: targetUserId,
            diagnostics: {
              targetUserId: targetUserId,
              legacyStorageUsers: tokenKeys,
              legacyStorageCount: tokenKeys.length
            }
          });

          return null;
        }
      }

      console.log(`[AutomationScheduler] ✅ Valid token acquired, proceeding with post creation...`);
      console.log(`[AutomationScheduler] ========================================`);

      // Use the updated method with better API handling
      const result = await this.createAutomatedPostWithToken(locationId, config, userToken.access_token);

      // If post was created successfully, update lastRun timestamp
      if (result) {
        console.log(`[AutomationScheduler] ✅ Post created successfully, updating lastRun timestamp`);

        // Update the lastRun time in settings
        if (this.settings.automations && this.settings.automations[locationId]) {
          if (!this.settings.automations[locationId].autoPosting) {
            this.settings.automations[locationId].autoPosting = {};
          }
          this.settings.automations[locationId].autoPosting.lastRun = new Date().toISOString();
          await this.updateAutomationSettings(locationId, this.settings.automations[locationId]);
          console.log(`[AutomationScheduler] ✅ lastRun updated in Supabase: ${this.settings.automations[locationId].autoPosting.lastRun}`);
        }
      }

      return result;

    } catch (error) {
      console.error(`[AutomationScheduler] ❌ Error creating automated post:`, error);
      console.error(`[AutomationScheduler] Error stack:`, error.stack);

      // Log the error
      const targetUserId = config?.userId || config?.autoPosting?.userId || 'system';
      this.logAutomationActivity(locationId, 'post_failed', {
        userId: targetUserId,
        error: error.message,
        timestamp: new Date().toISOString(),
        reason: 'system_error',
        errorStack: error.stack
      });

      return null;
    }
  }

  // Generate call-to-action based on button configuration
  generateCallToAction(config) {
    const button = config.button;
    const phoneNumber = config.phoneNumber;
    const websiteUrl = config.websiteUrl;
    const category = config.category || '';

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
      category: category
    });

    // If button is explicitly disabled or type is 'none', return null
    if (button?.enabled === false || button?.type === 'none') {
      console.log('[AutomationScheduler] ❌ CTA button explicitly disabled or type is "none"');
      console.log('[AutomationScheduler] ========================================');
      return null;
    }

    // Default to auto selection if no button config or button enabled
    const buttonType = button?.type || 'auto';
    console.log(`[AutomationScheduler] ✅ Button type: ${buttonType}`);

    // Handle different button types
    let actionType = 'LEARN_MORE'; // Default
    let url = button?.customUrl || websiteUrl || '';

    switch (buttonType) {
      case 'call_now':
        // Use phone number from button config first, then from business profile
        const phone = button?.phoneNumber || phoneNumber;
        console.log('[AutomationScheduler] 📞 Call Now button - Phone numbers:', {
          fromButton: button?.phoneNumber || 'NONE',
          fromProfile: phoneNumber || 'NONE',
          finalPhone: phone || 'NONE'
        });
        if (!phone) {
          console.error('[AutomationScheduler] ❌ Call Now button selected but no phone number available');
          console.error('[AutomationScheduler] ⚠️ Falling back to LEARN_MORE with website URL');
          if (!url) {
            console.log('[AutomationScheduler] ========================================');
            return null;
          }
          // Fallback to LEARN_MORE if no phone
          const fallbackCTA = {
            actionType: 'LEARN_MORE',
            url: url
          };
          console.log('[AutomationScheduler] ⚠️ Generated fallback CTA:', fallbackCTA);
          console.log('[AutomationScheduler] ========================================');
          return fallbackCTA;
        }
        // Google My Business API v4 doesn't accept phoneNumber in callToAction
        // It automatically uses the phone number from the business profile
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
        // Smart selection based on business category
        const lowerCategory = category.toLowerCase();

        if (lowerCategory.includes('restaurant') || lowerCategory.includes('food')) {
          actionType = 'ORDER';
        } else if (lowerCategory.includes('salon') || lowerCategory.includes('spa') ||
                   lowerCategory.includes('health') || lowerCategory.includes('clinic')) {
          actionType = 'BOOK';
        } else if (lowerCategory.includes('retail') || lowerCategory.includes('shop') ||
                   lowerCategory.includes('store')) {
          actionType = 'SHOP';
        } else if (lowerCategory.includes('education') || lowerCategory.includes('school') ||
                   lowerCategory.includes('course')) {
          actionType = 'SIGN_UP';
        } else {
          actionType = 'LEARN_MORE';
        }
        console.log(`[AutomationScheduler] Auto-selected CTA type: ${actionType} for category: ${category}`);
        break;
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

      const HARDCODED_ACCOUNT_ID = '106433552101751461082';
      const url = `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${HARDCODED_ACCOUNT_ID}/locations/${locationId}?readMask=storefrontAddress,title`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.storefrontAddress) {
          return {
            fullAddress: data.storefrontAddress.addressLines?.join(', ') || '',
            city: data.storefrontAddress.locality || '',
            region: data.storefrontAddress.administrativeArea || '',
            country: data.storefrontAddress.regionCode || '',
            postalCode: data.storefrontAddress.postalCode || ''
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
    const businessName = config.businessName || 'Business';
    const category = config.category || 'service';
    const keywords = config.keywords || 'quality, service, professional';
    let city = config.city || config.locationName || '';
    let region = config.region || '';
    let country = config.country || '';
    let fullAddress = config.fullAddress || '';
    const websiteUrl = config.websiteUrl || '';
    let postalCode = config.postalCode || config.pinCode || '';

    // If address is missing, fetch it from Google API
    if (!fullAddress && !city && locationId && userId) {
      console.log('[AutomationScheduler] 📍 Address missing in config, fetching from Google API...');
      const addressData = await this.fetchLocationAddress(locationId, userId);
      if (addressData) {
        fullAddress = addressData.fullAddress;
        city = addressData.city;
        region = addressData.region;
        country = addressData.country;
        postalCode = addressData.postalCode;
        console.log('[AutomationScheduler] ✅ Fetched address from Google API:', fullAddress);
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

    // Build complete address for the footer
    let completeAddress = '';
    if (fullAddress || city) {
      completeAddress = fullAddress || city;
      if (region && !completeAddress.includes(region)) {
        completeAddress += `, ${region}`;
      }
      // Only add postal code if it's not already in the fullAddress
      if (postalCode && !completeAddress.includes(postalCode)) {
        completeAddress += ` ${postalCode}`;
      }
    }
    
    console.log(`[AutomationScheduler] ========================================`);
    console.log(`[AutomationScheduler] 🎯 POST GENERATION PARAMETERS`);
    console.log(`[AutomationScheduler] Business Name: ${businessName}`);
    console.log(`[AutomationScheduler] Category: ${category}`);
    console.log(`[AutomationScheduler] 🔑 KEYWORDS: ${keywords}`);
    console.log(`[AutomationScheduler] Location: ${locationStr}`);
    console.log(`[AutomationScheduler] Complete Address: ${completeAddress}`);
    console.log(`[AutomationScheduler] Website: ${websiteUrl}`);
    console.log(`[AutomationScheduler] ========================================`);
    
    if (!this.apiKey || !this.azureEndpoint) {
      throw new Error('[AutomationScheduler] Azure OpenAI not configured - AI generation is required');
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
      
      const prompt = `Create a natural, engaging Google Business Profile post for ${businessName}, a ${category}${locationStr ? ` in ${locationStr}` : ''}.

Business Name: ${businessName}
Business Type: ${category}
Location: ${locationStr || 'local area'}
Complete Address: ${completeAddress}
Focus areas: ${Array.isArray(keywordList) ? keywordList.slice(0, 3).join(', ') : keywordList}
Business Categories: ${config.categories ? config.categories.join(', ') : category}
${websiteUrl ? `Website: ${websiteUrl}` : ''}

Context: Write for ${dayOfWeek} ${timeOfDay}

CRITICAL RULES - MUST FOLLOW ALL:
1. Write EXACTLY 100-120 words for the main content
2. MUST mention the exact business name "${businessName}" prominently
3. MUST incorporate business categories and keywords naturally
4. Focus on what this specific ${category} offers in ${locationStr || 'the area'}
5. Be location-specific - mention local landmarks, neighborhoods, or what makes this location special
6. For hotels/resorts: mention stays, rooms, amenities, relaxation
7. For restaurants: mention food, dining, atmosphere
8. For services: mention solutions, expertise, results
9. Include relevant business keywords naturally in the content
10. Write naturally and conversationally
11. ⚠️ CRITICAL FORMATTING REQUIREMENT ⚠️: ALWAYS end your response with exactly this format:

[Main post content here]

📍 Address: ${completeAddress}

12. The address line is MANDATORY and must be on a separate line with two line breaks before it
13. DO NOT include the address anywhere else in the post - only at the very end in the specified format`;

      const response = await fetch(
        `${this.azureEndpoint}openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.apiKey
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are a professional social media content writer for Google Business Profiles. CRITICAL FORMATTING RULE: Every post MUST end with the exact format "📍 Address: [complete address]" on a separate line after two line breaks. This address line is mandatory and must be included in every single post. Write engaging content that incorporates business keywords and location details naturally. Focus on what the business offers while mentioning the business name and incorporating relevant keywords.`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 250,
            temperature: 0.95,
            frequency_penalty: 0.7,
            presence_penalty: 0.5,
            top_p: 0.95
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        let content = data.choices[0].message.content.trim();

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
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('[AutomationScheduler] Critical error - AI generation failed:', error);
      throw new Error(`AI content generation failed: ${error.message}. Please ensure Azure OpenAI is properly configured.`);
    }
  }

  // Start monitoring reviews for auto-reply
  startReviewMonitoring(locationId, config) {
    if (this.reviewCheckIntervals.has(locationId)) {
      console.log(`[AutomationScheduler] Review monitoring already active for location ${locationId}`);
      return;
    }

    console.log(`[AutomationScheduler] Starting review monitoring for location ${locationId}`);
    console.log(`[AutomationScheduler] ⚡ Auto-reply is ACTIVE - will check and reply to new reviews every 10 minutes automatically`);
    
    // Check for new reviews every 10 minutes for faster response
    const interval = setInterval(async () => {
      console.log(`[AutomationScheduler] 🔍 Checking for new reviews to auto-reply...`);
      await this.checkAndReplyToReviews(locationId, config);
    }, 10 * 60 * 1000); // 10 minutes

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
      
      let userToken = await this.getValidTokenForUser(targetUserId);
      
      if (!userToken) {
        // Try to find any available valid token
        console.log(`[AutomationScheduler] No token for ${targetUserId}, checking all available tokens...`);
        const tokens = this.loadTokens();
        const tokenKeys = Object.keys(tokens);
        
        if (tokenKeys.length > 0) {
          for (const userId of tokenKeys) {
            const validToken = await this.getValidTokenForUser(userId);
            if (validToken) {
              userToken = validToken;
              console.log(`[AutomationScheduler] ⚡ Using valid token from user: ${userId} for review checking`);
              break;
            }
          }
        }
        
        if (!userToken) {
          console.error(`[AutomationScheduler] ⚠️ No valid tokens available. User needs to reconnect to Google Business Profile.`);
          console.log(`[AutomationScheduler] 💡 Token will be saved when user reconnects via Settings > Connections`);
          return null;
        }
      }

      // Get reviews from Google Business Profile API - try modern endpoint first
      let response;
      let reviews = [];
      
      // Use Google Business Profile API v4 (current version)
      const accountId = config.accountId || '106433552101751461082';
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
      const accountId = config.accountId || '106433552101751461082';
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
  async generateReviewReply(review, config) {
    // Convert rating string to number
    const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
    let rating = review.starRating?.value || review.starRating || 5;

    // If rating is a string like "FIVE", convert to number
    if (typeof rating === 'string') {
      rating = ratingMap[rating.toUpperCase()] || 5;
    }

    const reviewText = review.comment || '';
    const businessName = config.businessName || 'our business';
    const reviewerName = review.reviewer?.displayName || 'valued customer';
    const keywords = config.keywords || '';
    const category = config.category || 'business';

    if (!this.apiKey || !this.azureEndpoint) {
      throw new Error('[AutomationScheduler] Azure OpenAI not configured - AI generation is required for review replies');
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
      
      // Add variety with random elements
      const randomSeed = Math.random();
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
      
      const prompt = `Generate a SHORT, natural reply to this Google Business review for "${businessName}" (${category}):

Reviewer Name: ${reviewerName}
Rating: ${rating}/5 stars
Review Text: "${reviewText}"
Business Keywords: ${keywordList.length > 0 ? keywordList.join(', ') : 'quality service, customer satisfaction'}
Random Seed: ${randomSeed}

STRICT Requirements:
1. Write EXACTLY 35-55 words (SHORT and concise!)
2. Use a ${tone} tone
3. Optionally address reviewer by first name if appropriate (keep it casual)
4. Briefly reference something specific they mentioned
5. If positive, naturally include ONE business keyword if it fits
6. Thank them genuinely but briefly
7. If negative, apologize and offer to help (keep it short)
8. NO formal closings like "Warm regards", "Best wishes", "Sincerely", etc.
9. NO signature lines or "[Your Name]" placeholders
10. NO business name at the end
11. End naturally - just finish the message without any sign-off
12. Make it sound like a quick, friendly message from the business
13. Keep it conversational and human, not formal
14. Think: friendly text message, not business letter`;

      const response = await fetch(
        `${this.azureEndpoint}openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.apiKey
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are the owner or manager of ${businessName}, a ${category} business, personally responding to customer reviews. Write authentic, heartfelt responses that show you genuinely care about each customer's experience. Naturally incorporate the business's strengths and keywords when relevant, but keep it subtle and appropriate to the context. Never use generic templates. Each response should feel like it was written specifically for this reviewer, while highlighting what makes your business special.`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 200,
            temperature: 0.85,
            frequency_penalty: 0.6,
            presence_penalty: 0.4
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const replyText = data.choices[0].message.content.trim();
        console.log(`[AutomationScheduler] AI generated unique reply (${replyText.split(' ').length} words)`);
        return replyText;
      } else {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('[AutomationScheduler] Critical error - AI reply generation failed:', error);
      throw new Error(`AI reply generation failed: ${error.message}. Please ensure Azure OpenAI is properly configured.`);
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
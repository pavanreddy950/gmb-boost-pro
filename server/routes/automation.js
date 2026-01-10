import express from 'express';
import automationScheduler from '../services/automationScheduler.js';
import scheduledPostsService from '../services/scheduledPostsService.js';

const router = express.Router();

// Get automation status for a location
router.get('/status/:locationId', (req, res) => {
  try {
    const { locationId } = req.params;
    const status = automationScheduler.getAutomationStatus(locationId);
    res.json(status);
  } catch (error) {
    console.error('Error getting automation status:', error);
    res.status(500).json({ error: 'Failed to get automation status' });
  }
});

// Get automation status for ALL locations (DATABASE ONLY - bulk endpoint for dashboard)
router.get('/status-all', async (req, res) => {
  try {
    const { userId, email } = req.query;

    // 🔥 DATABASE ONLY - Query user_locations table (NEW CLEAN SCHEMA)
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('user_locations').select('*').eq('autoposting_enabled', true);

    // Filter by email (gmail_id) if provided - this is the new primary key
    if (email) {
      query = query.eq('gmail_id', email);
    }

    const { data: dbLocations, error } = await query;

    if (error) {
      console.error('[Automation API] Database error:', error);
      // Don't fail - fall back to in-memory
    }

    const now = new Date();
    const results = {};

    // Process database locations
    for (const location of (dbLocations || [])) {
      const locationId = location.location_id;

      if (!location.autoposting_enabled) {
        results[locationId] = {
          enabled: false,
          locationId,
          businessName: location.business_name || 'Unknown'
        };
        continue;
      }

      const lastRun = location.last_post_date ? new Date(location.last_post_date) : null;
      const nextScheduledTime = calculateNextPostTime(location.autoposting_schedule, location.autoposting_frequency, lastRun);

      let countdown = null;
      if (nextScheduledTime) {
        const timeRemainingMs = nextScheduledTime.getTime() - now.getTime();
        const isOverdue = timeRemainingMs <= 0;
        const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        countdown = {
          hours,
          minutes,
          seconds,
          totalSeconds,
          isOverdue,
          display: isOverdue ? 'Posting soon...' : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        };
      }

      results[locationId] = {
        success: true,
        enabled: true,
        locationId,
        businessName: location.business_name,
        schedule: location.autoposting_schedule,
        frequency: location.autoposting_frequency,
        timezone: location.autoposting_timezone || 'Asia/Kolkata',
        lastRun: lastRun?.toISOString() || null,
        nextPostTime: nextScheduledTime?.toISOString() || null,
        nextPostTimeLocal: nextScheduledTime?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) || null,
        countdown,
        hasCronJob: automationScheduler.scheduledJobs.has(locationId),
        source: 'database'
      };
    }

    // Also check in-memory scheduler for any additional locations
    const inMemoryAutomations = automationScheduler.settings?.automations || {};
    for (const [locationId, settings] of Object.entries(inMemoryAutomations)) {
      // Skip if already in results from database
      if (results[locationId]) continue;

      const autoPosting = settings.autoPosting || settings;
      if (!autoPosting.enabled && !settings.enabled) continue;

      const lastRun = autoPosting.lastRun ? new Date(autoPosting.lastRun) : null;
      const nextScheduledTime = calculateNextPostTime(autoPosting.schedule, autoPosting.frequency, lastRun);

      let countdown = null;
      if (nextScheduledTime) {
        const timeRemainingMs = nextScheduledTime.getTime() - now.getTime();
        const isOverdue = timeRemainingMs <= 0;
        const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        countdown = {
          hours,
          minutes,
          seconds,
          totalSeconds,
          isOverdue,
          display: isOverdue ? 'Posting soon...' : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        };
      }

      results[locationId] = {
        success: true,
        enabled: true,
        locationId,
        businessName: autoPosting.businessName || settings.businessName || 'Unknown',
        schedule: autoPosting.schedule,
        frequency: autoPosting.frequency,
        timezone: autoPosting.timezone || 'Asia/Kolkata',
        lastRun: lastRun?.toISOString() || null,
        nextPostTime: nextScheduledTime?.toISOString() || null,
        nextPostTimeLocal: nextScheduledTime?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) || null,
        countdown,
        hasCronJob: automationScheduler.scheduledJobs.has(locationId),
        source: 'memory'
      };
    }

    res.json({
      success: true,
      count: Object.keys(results).length,
      automations: results,
      serverTime: now.toISOString(),
      serverTimeIST: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
  } catch (error) {
    console.error('Error getting all automation status:', error);
    res.status(500).json({ error: 'Failed to get automation status' });
  }
});

// Get next scheduled post time for a location (DATABASE ONLY - no cache)
router.get('/next-post-time/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;

    // 🔥 DATABASE ONLY - Query user_locations table (NEW CLEAN SCHEMA)
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query user_locations table instead of automation_settings
    const { data: locationData, error } = await supabase
      .from('user_locations')
      .select('*')
      .eq('location_id', locationId)
      .eq('autoposting_enabled', true)
      .maybeSingle();

    // Also check in-memory scheduler as fallback
    const inMemorySettings = automationScheduler.settings?.automations?.[locationId];
    const inMemoryEnabled = inMemorySettings?.autoPosting?.enabled || inMemorySettings?.enabled;

    if (error) {
      console.log(`[next-post-time] DB error for ${locationId}:`, error.message);
    }

    // Use database data if available, otherwise fall back to in-memory
    if (!locationData && !inMemoryEnabled) {
      return res.json({
        success: false,
        enabled: false,
        message: 'Auto-posting is not enabled for this location'
      });
    }

    // Extract schedule data from database or in-memory
    let schedule, frequency, businessName, lastRun, timezone;

    if (locationData) {
      // Use user_locations table data
      schedule = locationData.autoposting_schedule;
      frequency = locationData.autoposting_frequency;
      businessName = locationData.business_name;
      lastRun = locationData.last_post_date ? new Date(locationData.last_post_date) : null;
      timezone = locationData.autoposting_timezone || 'Asia/Kolkata';
    } else if (inMemorySettings) {
      // Use in-memory data
      const autoPosting = inMemorySettings.autoPosting || inMemorySettings;
      schedule = autoPosting.schedule;
      frequency = autoPosting.frequency;
      businessName = autoPosting.businessName || inMemorySettings.businessName;
      lastRun = autoPosting.lastRun ? new Date(autoPosting.lastRun) : null;
      timezone = autoPosting.timezone || 'Asia/Kolkata';
    }

    // Calculate next scheduled time
    const nextScheduledTime = calculateNextPostTime(schedule, frequency, lastRun);

    const now = new Date();
    const serverTimeIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });

    let timeRemainingMs = 0;
    let isOverdue = false;

    if (nextScheduledTime) {
      timeRemainingMs = nextScheduledTime.getTime() - now.getTime();
      isOverdue = timeRemainingMs <= 0;
    }

    const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    res.json({
      success: true,
      enabled: true,
      locationId,
      businessName: businessName || 'Unknown',
      schedule: schedule || '10:00',
      frequency: frequency || 'daily',
      timezone: timezone,
      lastRun: lastRun?.toISOString() || null,
      nextPostTime: nextScheduledTime?.toISOString() || null,
      nextPostTimeLocal: nextScheduledTime?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) || null,
      serverTimeIST,
      countdown: {
        hours,
        minutes,
        seconds,
        totalSeconds,
        isOverdue,
        display: isOverdue ? 'Posting soon...' : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      },
      hasCronJob: automationScheduler.scheduledJobs.has(locationId),
      source: locationData ? 'database' : 'memory'
    });
  } catch (error) {
    console.error('Error getting next post time:', error);
    res.status(500).json({ error: 'Failed to get next post time' });
  }
});

// Helper function to calculate next post time (used by database-only endpoints)
function calculateNextPostTime(schedule, frequency, lastRun) {
  if (!schedule) return null;

  const [hours, minutes] = schedule.split(':').map(Number);
  const now = new Date();

  // IST offset is +5:30 from UTC (in milliseconds)
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

  // Get current UTC time
  const nowUtc = now.getTime();

  // Convert to IST for date calculations
  const nowIst = new Date(nowUtc + IST_OFFSET_MS);

  // Create scheduled time for today in IST (as UTC Date with IST values for calculation)
  const scheduledIst = new Date(nowIst);
  scheduledIst.setUTCHours(hours, minutes, 0, 0);

  // Check if we already posted today (in IST)
  const lastRunDate = lastRun ? new Date(lastRun) : null;
  let alreadyPostedToday = false;

  if (lastRunDate) {
    const lastRunUtc = lastRunDate.getTime();
    const lastRunIst = new Date(lastRunUtc + IST_OFFSET_MS);

    alreadyPostedToday =
      lastRunIst.getUTCDate() === nowIst.getUTCDate() &&
      lastRunIst.getUTCMonth() === nowIst.getUTCMonth() &&
      lastRunIst.getUTCFullYear() === nowIst.getUTCFullYear();
  }

  if (frequency === 'daily') {
    // If scheduled time passed OR already posted today, move to tomorrow
    if (scheduledIst <= nowIst || alreadyPostedToday) {
      scheduledIst.setUTCDate(scheduledIst.getUTCDate() + 1);
    }
  } else if (frequency === 'alternative' || frequency === 'every_2_days') {
    // Every 2 days
    if (scheduledIst <= nowIst || alreadyPostedToday) {
      scheduledIst.setUTCDate(scheduledIst.getUTCDate() + 2);
    }
  } else if (frequency === 'weekly') {
    // Weekly
    if (scheduledIst <= nowIst || alreadyPostedToday) {
      scheduledIst.setUTCDate(scheduledIst.getUTCDate() + 7);
    }
  }

  // Convert scheduled IST time back to actual UTC
  // scheduledIst contains IST values stored as UTC, so subtract IST offset to get real UTC
  const scheduledUtc = new Date(scheduledIst.getTime() - IST_OFFSET_MS);

  return scheduledUtc;
}

// Update automation settings for a location
router.post('/settings/:locationId', (req, res) => {
  try {
    const { locationId } = req.params;
    const settings = req.body;

    console.log(`[Automation API] ========================================`);
    console.log(`[Automation API] Updating settings for location ${locationId}`);
    console.log(`[Automation API] Incoming settings:`, JSON.stringify(settings, null, 2));
    console.log(`[Automation API] Keywords in autoPosting:`, settings.autoPosting?.keywords || 'MISSING');
    console.log(`[Automation API] Keywords in root:`, settings.keywords || 'MISSING');
    console.log(`[Automation API] 📍 Address info in autoPosting:`, {
      city: settings.autoPosting?.city,
      region: settings.autoPosting?.region,
      country: settings.autoPosting?.country,
      fullAddress: settings.autoPosting?.fullAddress,
      postalCode: settings.autoPosting?.postalCode
    });
    console.log(`[Automation API] 📞 Phone number:`, settings.autoPosting?.phoneNumber);
    console.log(`[Automation API] 🔘 Button config:`, settings.autoPosting?.button);

    // Ensure both autoPosting and autoReply are configured
    if (!settings.autoPosting) {
      console.log(`[Automation API] No autoPosting object - creating default`);
      settings.autoPosting = {
        enabled: true,
        schedule: '10:20',
        frequency: 'alternative',
        businessName: settings.businessName || 'Business',
        category: settings.category || 'business',
        keywords: settings.keywords || 'quality service, customer satisfaction',
        userId: settings.userId || 'default',
        userCustomizedTime: false, // User hasn't customized time - will use previous post time
        // Include address fields if they exist in root settings
        city: settings.city || '',
        region: settings.region || '',
        country: settings.country || '',
        fullAddress: settings.fullAddress || '',
        postalCode: settings.postalCode || '',
        phoneNumber: settings.phoneNumber || '',
        button: settings.button || { enabled: true, type: 'auto' }
      };
    } else {
      console.log(`[Automation API] autoPosting exists - preserving incoming data`);
      // DO NOT MODIFY the incoming autoPosting object - just ensure userId and accountId are set
      if (!settings.autoPosting.userId) {
        settings.autoPosting.userId = settings.userId || 'default';
      }
      if (!settings.autoPosting.accountId) {
        settings.autoPosting.accountId = settings.accountId || '106433552101751461082';
      }
      // Ensure phone number and button config are preserved
      if (settings.phoneNumber && !settings.autoPosting.phoneNumber) {
        settings.autoPosting.phoneNumber = settings.phoneNumber;
      }
      if (settings.button && !settings.autoPosting.button) {
        settings.autoPosting.button = settings.button;
      }
    }

    if (!settings.autoReply) {
      settings.autoReply = {
        enabled: true,
        businessName: settings.businessName || settings.autoPosting?.businessName || 'Business',
        category: settings.category || settings.autoPosting?.category || 'business',
        keywords: settings.keywords || settings.autoPosting?.keywords || 'quality service, customer satisfaction',
        replyToAll: true,
        userId: settings.userId || 'default',
        accountId: settings.accountId || '106433552101751461082'
      };
    } else {
      // Preserve all incoming autoReply properties (including keywords!)
      settings.autoReply.userId = settings.userId || settings.autoReply.userId || 'default';
      settings.autoReply.accountId = settings.accountId || settings.autoReply.accountId || '106433552101751461082';
      // Ensure keywords from autoReply settings are preserved
      if (settings.autoReply.keywords === undefined && (settings.keywords || settings.autoPosting?.keywords)) {
        settings.autoReply.keywords = settings.keywords || settings.autoPosting?.keywords;
      }
    }

    const updatedSettings = automationScheduler.updateAutomationSettings(locationId, settings);
    console.log(`[Automation API] ✅ Settings saved successfully`);
    console.log(`[Automation API] Saved keywords:`, updatedSettings.autoPosting?.keywords || 'NONE');
    console.log(`[Automation API] 📍 Saved address info:`, {
      city: updatedSettings.autoPosting?.city,
      region: updatedSettings.autoPosting?.region,
      country: updatedSettings.autoPosting?.country,
      fullAddress: updatedSettings.autoPosting?.fullAddress,
      postalCode: updatedSettings.autoPosting?.postalCode
    });
    console.log(`[Automation API] 📞 Saved phone number:`, updatedSettings.autoPosting?.phoneNumber || 'NONE');
    console.log(`[Automation API] 🔘 Saved button config:`, updatedSettings.autoPosting?.button || 'NONE');
    console.log(`[Automation API] Full saved settings:`, JSON.stringify(updatedSettings, null, 2));
    console.log(`[Automation API] ========================================`);

    res.json({
      success: true,
      settings: updatedSettings,
      status: automationScheduler.getAutomationStatus(locationId)
    });
  } catch (error) {
    console.error('Error updating automation settings:', error);
    res.status(500).json({ error: 'Failed to update automation settings' });
  }
});

// Manually trigger auto-posting for a location
router.post('/trigger-post/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const config = req.body;

    console.log(`[Automation API] ========================================`);
    console.log(`[Automation API] 🚀 MANUAL POST TRIGGER for location ${locationId}`);
    console.log(`[Automation API] Config received:`, JSON.stringify(config, null, 2));
    console.log(`[Automation API] ========================================`);

    // Get existing automation settings if config is not complete
    const settings = automationScheduler.settings.automations?.[locationId];

    // Merge with provided config, ensuring all required fields are present
    const mergedConfig = {
      ...settings?.autoPosting,
      ...config,
      userId: config.userId || settings?.autoPosting?.userId || 'default',
      accountId: config.accountId || settings?.autoPosting?.accountId,
      gbpAccountId: config.gbpAccountId || settings?.autoPosting?.gbpAccountId || config.accountId,
      businessName: config.businessName || settings?.autoPosting?.businessName || 'Business',
      keywords: config.keywords || settings?.autoPosting?.keywords || config.businessName,
      categories: config.categories || settings?.autoPosting?.categories || [],
      frequency: config.frequency || settings?.autoPosting?.frequency || 'daily',
      schedule: config.schedule || settings?.autoPosting?.schedule || '10:00'
    };

    console.log(`[Automation API] Merged config:`, {
      businessName: mergedConfig.businessName,
      userId: mergedConfig.userId,
      keywords: mergedConfig.keywords?.substring?.(0, 50) || mergedConfig.keywords,
      frequency: mergedConfig.frequency,
      schedule: mergedConfig.schedule
    });

    // If no settings exist in scheduler, save them first
    if (!settings?.autoPosting) {
      console.log(`[Automation API] No existing settings found, creating new configuration`);
      await automationScheduler.updateAutomationSettings(locationId, {
        autoPosting: {
          ...mergedConfig,
          enabled: true
        }
      });
    }

    const result = await automationScheduler.createAutomatedPost(locationId, mergedConfig);

    if (result) {
      console.log(`[Automation API] ✅ Post created successfully`);
      res.json({
        success: true,
        message: 'Post created successfully',
        postId: result.name || result.id
      });
    } else {
      console.log(`[Automation API] ⚠️ Post creation returned null (may have been blocked by subscription or duplicate check)`);
      res.json({
        success: false,
        message: 'Post creation blocked - check subscription or duplicate post prevention'
      });
    }
  } catch (error) {
    console.error('[Automation API] ❌ Error triggering post:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger post'
    });
  }
});

// Manually trigger review check for a location
router.post('/check-reviews/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const config = req.body;

    console.log(`[Automation API] Manually checking reviews for location ${locationId}`);

    await automationScheduler.checkAndReplyToReviews(locationId, config);

    res.json({ success: true, message: 'Review check completed' });
  } catch (error) {
    console.error('Error checking reviews:', error);
    res.status(500).json({ error: 'Failed to check reviews' });
  }
});

// Get automation logs
router.get('/logs', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '..', 'data', 'automation_log.json');

    if (fs.existsSync(logFile)) {
      const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      res.json(log);
    } else {
      res.json({ activities: [] });
    }
  } catch (error) {
    console.error('Error getting automation logs:', error);
    res.status(500).json({ error: 'Failed to get automation logs' });
  }
});

// Stop all automations for a location
router.post('/stop/:locationId', (req, res) => {
  try {
    const { locationId } = req.params;

    console.log(`[Automation API] Stopping all automations for location ${locationId}`);

    automationScheduler.stopAutoPosting(locationId);
    automationScheduler.stopReviewMonitoring(locationId);

    // Update settings to disabled
    automationScheduler.updateAutomationSettings(locationId, {
      autoPosting: { enabled: false },
      autoReply: { enabled: false }
    });

    res.json({ success: true, message: 'All automations stopped' });
  } catch (error) {
    console.error('Error stopping automations:', error);
    res.status(500).json({ error: 'Failed to stop automations' });
  }
});

// Test endpoint to manually create a post NOW for testing
router.post('/test-post-now/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { businessName, category, keywords, websiteUrl, locationName, city, region, country, fullAddress, accessToken, userId, phoneNumber, button } = req.body;

    // Get userId from header or body
    const userIdFromHeader = req.headers['x-user-id'];
    const finalUserId = userId || userIdFromHeader;

    // Get token from Authorization header or body (fallback only)
    let frontendToken = accessToken;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      frontendToken = authHeader.substring(7);
    }

    console.log(`[Automation API] TEST MODE - Creating post NOW for location ${locationId}`);
    console.log(`[Automation API] User ID from header:`, userIdFromHeader);
    console.log(`[Automation API] User ID from body:`, userId);
    console.log(`[Automation API] Final User ID:`, finalUserId);
    console.log(`[Automation API] Token from body:`, accessToken ? 'Present' : 'Missing');
    console.log(`[Automation API] Token from header:`, authHeader ? 'Present' : 'Missing');
    console.log(`[Automation API] Frontend token available:`, frontendToken ? 'Yes' : 'No');

    // Get existing automation settings OR create default
    let settings = automationScheduler.settings.automations?.[locationId];

    // If no settings exist, create default configuration
    if (!settings?.autoPosting) {
      console.log(`[Automation API] No config found, creating default auto-posting configuration for location ${locationId}`);

      // Create default configuration
      const defaultConfig = {
        autoPosting: {
          enabled: true,
          schedule: '10:20',
          frequency: 'alternative', // Every 2 days
          businessName: businessName || 'Business',
          category: category || 'business',
          keywords: keywords || 'quality service, customer satisfaction, professional',
          websiteUrl: websiteUrl || '',
          locationName: locationName || '',
          timezone: 'Asia/Kolkata',
          userId: 'default',
          userCustomizedTime: false // User hasn't customized time - will use previous post time
        },
        autoReply: {
          enabled: true,
          businessName: businessName || 'Business',
          category: category || 'business',
          keywords: keywords || 'quality service, customer satisfaction, professional',
          replyToAll: true,
          userId: 'default',
          accountId: '106433552101751461082'
        }
      };

      // Save the default configuration
      automationScheduler.updateAutomationSettings(locationId, defaultConfig);
      settings = { ...defaultConfig };
    }

    // Create test config with all necessary data including location info
    const testConfig = {
      ...settings.autoPosting,
      businessName: businessName || settings.autoPosting.businessName || 'Business',
      category: category || settings.autoPosting.category || 'business',
      keywords: keywords || settings.autoPosting.keywords || 'quality service',
      websiteUrl: websiteUrl || settings.autoPosting.websiteUrl || '',
      locationName: locationName || city || settings.autoPosting.locationName || '',
      city: city || locationName || '',
      region: region || '',
      country: country || '',
      fullAddress: fullAddress || '',
      phoneNumber: phoneNumber || settings.autoPosting.phoneNumber || '',
      button: button || settings.autoPosting.button || { enabled: false, type: 'none' },
      userId: finalUserId || settings.autoPosting.userId || 'default',
      accountId: settings.autoPosting.accountId || settings.accountId || '106433552101751461082',
      test: true
    };

    console.log(`[Automation API] Test config:`, testConfig);

    // PRIORITY 1: Try to get valid token from backend storage (with auto-refresh)
    console.log(`[Automation API] 🔍 STEP 1: Attempting to get backend stored token for user ${finalUserId}`);
    let result;
    let backendToken = null;

    try {
      // Import the token storage at the top if not already imported
      const supabaseTokenStorage = (await import('../services/supabaseTokenStorage.js')).default;

      // Try to get a valid token from backend storage (this will auto-refresh if expired)
      backendToken = await supabaseTokenStorage.getValidToken(finalUserId);

      if (backendToken && backendToken.access_token) {
        console.log(`[Automation API] ✅ STEP 1: Backend has valid token for user ${finalUserId}, using it`);
        result = await automationScheduler.createAutomatedPostWithToken(locationId, testConfig, backendToken.access_token);
      } else {
        console.log(`[Automation API] ❌ STEP 1: No backend token found`);

        // PRIORITY 2: Fall back to frontend token if backend has none
        if (frontendToken) {
          console.log(`[Automation API] 🔄 STEP 2: Using frontend token as fallback`);
          result = await automationScheduler.createAutomatedPostWithToken(locationId, testConfig, frontendToken);
        } else {
          console.log(`[Automation API] ❌ STEP 2: No frontend token available either`);
          // No tokens available at all
          result = null;
        }
      }
    } catch (tokenError) {
      console.error(`[Automation API] ❌ Error getting backend token:`, tokenError);

      // Fall back to frontend token on error
      if (frontendToken) {
        console.log(`[Automation API] 🔄 Falling back to frontend token due to backend error`);
        result = await automationScheduler.createAutomatedPostWithToken(locationId, testConfig, frontendToken);
      } else {
        console.log(`[Automation API] ❌ No frontend token available as fallback`);
        result = null;
      }
    }

    // Check if post was actually created
    if (result === undefined || result === null) {
      // Post creation failed (likely due to no token)
      console.error(`[Automation API] ❌ Post creation returned null/undefined`);
      return res.status(401).json({
        success: false,
        error: 'Failed to create post. No Google account connected or token invalid.',
        details: 'Please connect your Google Business Profile account in Settings > Connections first.',
        requiresAuth: true,
        debugInfo: {
          hadBackendToken: !!backendToken,
          hadFrontendToken: !!frontendToken,
          userId: finalUserId
        }
      });
    }

    console.log(`[Automation API] ✅ Post created successfully!`);
    res.json({
      success: true,
      message: 'Test post created successfully! Check your Google Business Profile.',
      config: testConfig,
      result: result
    });
  } catch (error) {
    console.error('[Automation API] ❌ Error in test-post-now endpoint:', error);
    console.error('[Automation API] Error stack:', error.stack);
    res.status(500).json({
      error: error.message || 'Failed to create test post',
      details: error.toString(),
      stack: error.stack
    });
  }
});

// Test endpoint to check review auto-reply NOW
router.post('/test-review-check/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { businessName, category, keywords } = req.body;

    console.log(`[Automation API] TEST MODE - Checking reviews NOW for location ${locationId}`);

    // Get existing automation settings OR create default
    let settings = automationScheduler.settings.automations?.[locationId];

    // If no settings exist, create default configuration
    if (!settings?.autoReply) {
      console.log(`[Automation API] No config found, creating default auto-reply configuration for location ${locationId}`);

      // Create default configuration
      const defaultConfig = {
        autoReply: {
          enabled: true,
          businessName: businessName || 'Business',
          category: category || 'business',
          keywords: keywords || 'quality service, customer satisfaction, professional',
          replyToAll: true,
          replyToPositive: true,
          replyToNegative: true,
          replyToNeutral: true,
          userId: 'default',
          accountId: '106433552101751461082'
        },
        autoPosting: {
          enabled: true,
          schedule: '10:20',
          frequency: 'alternative',
          businessName: businessName || 'Business',
          category: category || 'business',
          keywords: keywords || 'quality service, customer satisfaction, professional',
          userId: 'default',
          userCustomizedTime: false // User hasn't customized time - will use previous post time
        }
      };

      // Save the default configuration
      automationScheduler.updateAutomationSettings(locationId, defaultConfig);
      settings = { ...defaultConfig };
    }

    // Create test config
    const testConfig = {
      ...settings.autoReply,
      userId: settings.autoReply.userId || 'default',
      accountId: settings.autoReply.accountId || settings.accountId || '106433552101751461082',
      test: true
    };

    console.log(`[Automation API] Test config:`, testConfig);

    // Check and reply to reviews immediately
    const result = await automationScheduler.checkAndReplyToReviews(locationId, testConfig);

    // Check if review check actually worked
    if (result === undefined || result === null) {
      return res.status(401).json({
        success: false,
        error: 'Failed to check reviews. No Google account connected.',
        details: 'Please connect your Google Business Profile account in Settings > Connections first.',
        requiresAuth: true
      });
    }

    res.json({
      success: true,
      message: 'Review check completed! Any new reviews have been replied to.',
      config: testConfig,
      result: result
    });
  } catch (error) {
    console.error('Error checking reviews:', error);
    res.status(500).json({
      error: error.message || 'Failed to check reviews',
      details: error.toString()
    });
  }
});

// Test endpoint to generate post content only (no actual posting) - for testing address formatting
router.post('/test-generate-content/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { businessName, category, keywords, websiteUrl, city, region, country, fullAddress, postalCode } = req.body;

    console.log(`[Automation API] TEST MODE - Generating post content for location ${locationId}`);

    // Create config for content generation
    const config = {
      businessName: businessName || 'Scale Point Strategy',
      category: category || 'Digital Marketing Agency',
      keywords: keywords || 'digital marketing, business growth, social media',
      websiteUrl: websiteUrl || 'https://scalepointstrategy.com',
      city: city || 'Jalandhar',
      region: region || 'Punjab',
      country: country || 'India',
      postalCode: postalCode || '144001',
      fullAddress: fullAddress || `${city || 'Jalandhar'}, ${region || 'Punjab'} ${postalCode || '144001'}, ${country || 'India'}`,
      userId: 'test',
      test: true
    };

    console.log(`[Automation API] Content generation config:`, config);

    // Generate content using the automation scheduler's content generation function
    const result = await automationScheduler.generatePostContent(config);

    res.json({
      success: true,
      message: 'Post content generated successfully',
      config: config,
      content: result.content,
      callToAction: result.callToAction,
      addressCheck: {
        hasAddressLine: result.content.includes('📍 Address:'),
        fullAddress: config.fullAddress,
        expectedFormat: `📍 Address: ${config.fullAddress}`
      }
    });
  } catch (error) {
    console.error('Error generating post content:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate post content',
      details: error.toString()
    });
  }
});

// 🔍 DIAGNOSTIC ENDPOINTS - Check what's actually running

// Get all active cron jobs
router.get('/debug/active-jobs', (req, res) => {
  try {
    const activeJobs = [];

    // Get all scheduled jobs from the automation scheduler
    for (const [locationId, job] of automationScheduler.scheduledJobs.entries()) {
      const config = automationScheduler.settings.automations?.[locationId]?.autoPosting;
      activeJobs.push({
        locationId,
        businessName: config?.businessName || 'Unknown',
        frequency: config?.frequency || 'Unknown',
        schedule: config?.schedule || 'Unknown',
        lastRun: config?.lastRun || 'Never',
        isRunning: job ? true : false,
        timezone: config?.timezone || 'Asia/Kolkata'
      });
    }

    res.json({
      success: true,
      totalActiveJobs: activeJobs.length,
      activeJobs,
      reviewMonitors: automationScheduler.reviewCheckIntervals.size,
      message: activeJobs.length > 0
        ? `${activeJobs.length} cron job(s) are currently active`
        : 'No cron jobs are currently active! Automation is NOT running.'
    });
  } catch (error) {
    console.error('Error getting active jobs:', error);
    res.status(500).json({ error: 'Failed to get active jobs' });
  }
});

// Get all automation settings from in-memory cache
router.get('/debug/settings-cache', (req, res) => {
  try {
    const allSettings = automationScheduler.settings.automations || {};
    const summary = Object.entries(allSettings).map(([locationId, config]) => ({
      locationId,
      businessName: config.autoPosting?.businessName || config.autoReply?.businessName || 'Unknown',
      autoPostingEnabled: config.autoPosting?.enabled || false,
      autoReplyEnabled: config.autoReply?.enabled || false,
      schedule: config.autoPosting?.schedule,
      frequency: config.autoPosting?.frequency,
      lastRun: config.autoPosting?.lastRun,
      updatedAt: config.updatedAt
    }));

    res.json({
      success: true,
      totalLocations: summary.length,
      locationsWithAutoPosting: summary.filter(s => s.autoPostingEnabled).length,
      locationsWithAutoReply: summary.filter(s => s.autoReplyEnabled).length,
      settings: summary,
      message: summary.length > 0
        ? `Found ${summary.length} location(s) in settings cache`
        : 'No automation settings in memory cache! Nothing configured.'
    });
  } catch (error) {
    console.error('Error getting settings cache:', error);
    res.status(500).json({ error: 'Failed to get settings cache' });
  }
});

// Force reload all automations from Supabase
router.post('/debug/reload-automations', async (req, res) => {
  try {
    console.log('[Automation API] 🔄 Force reloading all automations from Supabase...');

    // Stop all existing automations
    automationScheduler.stopAllAutomations();

    // Reinitialize from Supabase
    await automationScheduler.initializeAutomations();

    const activeJobs = automationScheduler.scheduledJobs.size;

    res.json({
      success: true,
      message: `Automations reloaded! ${activeJobs} cron job(s) now active.`,
      activeJobs,
      reviewMonitors: automationScheduler.reviewCheckIntervals.size
    });
  } catch (error) {
    console.error('Error reloading automations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reload automations',
      details: error.message
    });
  }
});

// Diagnose auto-reply issues
router.get('/debug/diagnose-auto-reply', async (req, res) => {
  try {
    const supabaseAutomationService = (await import('../services/supabaseAutomationService.js')).default;
    const supabaseConfig = (await import('../config/supabase.js')).default;

    const diagnosis = {
      timestamp: new Date().toISOString(),
      issues: [],
      recommendations: []
    };

    // Check 1: Supabase connection
    try {
      const client = await supabaseConfig.ensureInitialized();
      diagnosis.supabaseConnected = true;
    } catch (error) {
      diagnosis.supabaseConnected = false;
      diagnosis.issues.push('Supabase not connected');
      diagnosis.recommendations.push('Check SUPABASE_URL and SUPABASE_SERVICE_KEY in env');
      return res.json(diagnosis);
    }

    // Check 2: Get all automation settings
    const allSettings = await supabaseAutomationService.getAllEnabledAutomations();
    diagnosis.totalSettings = allSettings.length;
    diagnosis.settingsWithAutoReply = allSettings.filter(s => s.autoReply?.enabled).length;

    if (allSettings.length === 0) {
      diagnosis.issues.push('No automation settings found in database');
      diagnosis.recommendations.push('User needs to enable automation in Settings page');
    }

    // Check 3: Review monitors status
    diagnosis.activeReviewMonitors = automationScheduler.reviewCheckIntervals.size;
    diagnosis.reviewMonitorsList = [];

    for (const [locationId, config] of Object.entries(automationScheduler.settings.automations || {})) {
      if (config.autoReply?.enabled) {
        const hasMonitor = automationScheduler.reviewCheckIntervals.has(locationId);
        diagnosis.reviewMonitorsList.push({
          locationId,
          businessName: config.autoReply.businessName,
          enabled: config.autoReply.enabled,
          hasActiveMonitor: hasMonitor
        });

        if (!hasMonitor) {
          diagnosis.issues.push(`Auto-reply enabled for ${config.autoReply.businessName} but monitor NOT running`);
          diagnosis.recommendations.push('Restart backend server to start review monitors');
        }
      }
    }

    // Check 4: Check interval setting
    diagnosis.checkInterval = '2 minutes (recently fixed from 10 minutes)';

    // Overall status
    if (diagnosis.issues.length === 0 && diagnosis.activeReviewMonitors > 0) {
      diagnosis.status = 'HEALTHY - Auto-reply should be working';
    } else if (diagnosis.settingsWithAutoReply > 0 && diagnosis.activeReviewMonitors === 0) {
      diagnosis.status = 'BROKEN - Settings exist but monitors not running';
      diagnosis.recommendations.push('URGENT: Restart backend server immediately');
    } else {
      diagnosis.status = 'NOT CONFIGURED - Auto-reply not set up';
    }

    res.json(diagnosis);
  } catch (error) {
    console.error('Error diagnosing auto-reply:', error);
    res.status(500).json({ error: 'Diagnostic failed', details: error.message });
  }
});

// Check scheduler status and statistics
router.get('/debug/scheduler-status', (req, res) => {
  try {
    const stats = {
      totalScheduledJobs: automationScheduler.scheduledJobs.size,
      totalReviewMonitors: automationScheduler.reviewCheckIntervals.size,
      totalLocationsInCache: Object.keys(automationScheduler.settings.automations || {}).length,
      postCreationLocks: automationScheduler.postCreationLocks.size,
      missedPostCheckerRunning: automationScheduler.missedPostCheckerInterval ? true : false,

      // List all locations with status
      locations: Object.entries(automationScheduler.settings.automations || {}).map(([locationId, config]) => ({
        locationId,
        businessName: config.autoPosting?.businessName || config.autoReply?.businessName,
        autoPosting: {
          enabled: config.autoPosting?.enabled || false,
          hasCronJob: automationScheduler.scheduledJobs.has(locationId),
          schedule: config.autoPosting?.schedule,
          frequency: config.autoPosting?.frequency,
          lastRun: config.autoPosting?.lastRun
        },
        autoReply: {
          enabled: config.autoReply?.enabled || false,
          hasMonitor: automationScheduler.reviewCheckIntervals.has(locationId)
        }
      }))
    };

    res.json({
      success: true,
      ...stats,
      message: stats.totalScheduledJobs > 0
        ? `Scheduler is running with ${stats.totalScheduledJobs} active job(s)`
        : 'Scheduler is running but NO cron jobs are active! Check your automation settings.'
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

// ============================================
// SUBSCRIPTION STATUS ENDPOINTS
// ============================================

// Check subscription status for all profiles
router.get('/subscription-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { gbpAccountId } = req.query;

    console.log(`[Automation API] 🔒 Checking subscription for userId: ${userId}, gbpAccountId: ${gbpAccountId}`);

    // Import subscriptionGuard dynamically to avoid circular imports
    const subscriptionGuard = (await import('../services/subscriptionGuard.js')).default;

    const validationResult = await subscriptionGuard.hasValidAccess(userId, gbpAccountId);

    res.json({
      success: true,
      userId,
      gbpAccountId,
      hasValidSubscription: validationResult.hasAccess,
      status: validationResult.status || validationResult.reason,
      daysRemaining: validationResult.daysRemaining || 0,
      message: validationResult.message
    });
  } catch (error) {
    console.error('[Automation API] Error checking subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription status'
    });
  }
});

// ============================================
// GLOBAL POSTING TIME ENDPOINT
// ============================================

// Set global posting time for all profiles (only for subscribed profiles)
router.post('/global-time', async (req, res) => {
  try {
    const { schedule, frequency, userId, email, locationIds, gbpAccountId, profiles } = req.body;

    if (!schedule || !frequency) {
      return res.status(400).json({
        success: false,
        error: 'Schedule and frequency are required'
      });
    }

    // Use email as primary identifier (gmail_id in database)
    const userEmail = email || userId;

    console.log(`[Automation API] ========================================`);
    console.log(`[Automation API] 🌐 GLOBAL TIME UPDATE REQUEST`);
    console.log(`[Automation API]    - Schedule: ${schedule}`);
    console.log(`[Automation API]    - Frequency: ${frequency}`);
    console.log(`[Automation API]    - Email: ${userEmail}`);
    console.log(`[Automation API]    - UserId: ${userId}`);
    console.log(`[Automation API]    - GBP Account: ${gbpAccountId}`);
    console.log(`[Automation API]    - Location count: ${locationIds?.length || 'ALL'}`);
    console.log(`[Automation API] ========================================`);

    // Import subscriptionGuard and supabase dynamically
    const subscriptionGuard = (await import('../services/subscriptionGuard.js')).default;
    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 🔒 First check if user has valid subscription (using email)
    const subscriptionCheck = await subscriptionGuard.hasValidAccess(userEmail, gbpAccountId);

    if (!subscriptionCheck.hasAccess) {
      console.log(`[Automation API] ❌ User ${userEmail} does not have valid subscription`);
      return res.status(403).json({
        success: false,
        error: 'No valid subscription',
        message: subscriptionCheck.message,
        reason: 'no_subscription'
      });
    }

    console.log(`[Automation API] ✅ User has valid subscription: ${subscriptionCheck.status}`);

    const results = [];

    // 🔥 Handle "today" frequency - trigger immediate posts
    const isImmediatePost = frequency === 'today';
    const actualFrequency = isImmediatePost ? 'daily' : frequency; // Store as 'daily' in DB for future posts

    if (isImmediatePost) {
      console.log(`[Automation API] ⚡ IMMEDIATE POST requested - will post NOW for all locations`);
    }

    // 🔥 NEW: Query user_locations table using gmail_id (email)
    const { data: userLocations, error: dbError } = await supabase
      .from('user_locations')
      .select('*')
      .eq('gmail_id', userEmail);

    if (dbError) {
      console.error(`[Automation API] ❌ Database error querying user_locations:`, dbError);
      return res.status(500).json({ success: false, error: 'Database error: ' + dbError.message });
    }

    console.log(`[Automation API] 📊 Found ${userLocations?.length || 0} locations in user_locations for ${userEmail}`);

    // If no locations in user_locations table, use profiles sent from frontend
    if (!userLocations || userLocations.length === 0) {
      console.log(`[Automation API] 📊 No locations in DB, checking frontend profiles...`);
      console.log(`[Automation API] 📊 Frontend sent ${profiles?.length || 0} profiles`);

      // Use profiles from frontend if available
      if (profiles && profiles.length > 0) {
        console.log(`[Automation API] 📊 Using ${profiles.length} profiles from frontend`);

        for (const profile of profiles) {
          const locationId = profile.locationId;
          const businessName = profile.businessName || 'Unknown';
          const address = profile.address || '';

          try {
            // Insert location to user_locations table
            const { error: upsertError } = await supabase
              .from('user_locations')
              .upsert({
                gmail_id: userEmail,
                location_id: locationId,
                business_name: businessName,
                address: address,
                autoposting_enabled: true,
                autoposting_schedule: schedule,
                autoposting_frequency: actualFrequency,
                autoposting_status: 'active',
                autoposting_status_reason: 'Enabled via global time setting',
                updated_at: new Date().toISOString()
              }, { onConflict: 'gmail_id,location_id' });

            if (upsertError) {
              console.error(`[Automation API] ❌ Upsert failed for ${locationId}:`, upsertError);
              results.push({ locationId, businessName, success: false, error: upsertError.message });
              continue;
            }

            // Update in-memory scheduler
            automationScheduler.settings.automations = automationScheduler.settings.automations || {};
            automationScheduler.settings.automations[locationId] = {
              enabled: true,
              email: userEmail,
              autoPosting: {
                enabled: true,
                schedule,
                frequency: actualFrequency,
                businessName,
                userCustomizedTime: true,
                email: userEmail
              }
            };

            // Schedule the automation (for future posts)
            try {
              automationScheduler.stopAutoPosting(locationId);
              automationScheduler.scheduleAutoPosting(locationId, {
                enabled: true,
                schedule,
                frequency: actualFrequency,
                businessName,
                email: userEmail
              });
            } catch (cronError) {
              console.warn(`[Automation API] ⚠️ Cron warning for ${locationId}:`, cronError.message);
            }

            // 🔥 If immediate post requested, trigger post NOW
            if (isImmediatePost) {
              console.log(`[Automation API] ⚡ Triggering IMMEDIATE post for ${businessName} (${locationId})`);
              // Run async - don't wait for completion
              automationScheduler.triggerImmediatePost(locationId, userEmail, businessName).catch(err => {
                console.error(`[Automation API] ❌ Immediate post failed for ${locationId}:`, err.message);
              });
            }

            console.log(`[Automation API] ✅ Inserted & scheduled ${businessName} (${locationId})`);
            results.push({ locationId, businessName, success: true, immediatePost: isImmediatePost });
          } catch (error) {
            console.error(`[Automation API] ❌ Error for ${locationId}:`, error);
            results.push({ locationId, businessName, success: false, error: error.message });
          }
        }
      } else {
        // Fallback to in-memory automations
        const automations = automationScheduler.settings.automations || {};
        const memoryLocations = Object.keys(automations).filter(locId => {
          const config = automations[locId];
          return config?.autoPosting?.userId === userId ||
                 config?.userId === userId ||
                 config?.autoPosting?.email === userEmail ||
                 config?.email === userEmail;
        });

        console.log(`[Automation API] 📊 Fallback: Found ${memoryLocations.length} locations in memory`);

        if (memoryLocations.length === 0) {
          return res.json({
            success: true,
            message: 'No profiles found to update. Please add locations first.',
            schedule,
            frequency,
            successCount: 0,
            failCount: 0,
            results: []
          });
        }

        // Insert memory locations to database and update them
        for (const locationId of memoryLocations) {
          const config = automations[locationId];
          const businessName = config?.autoPosting?.businessName || config?.businessName || 'Unknown';

          try {
            // Upsert location to user_locations table
            const { error: upsertError } = await supabase
              .from('user_locations')
              .upsert({
                gmail_id: userEmail,
                location_id: locationId,
                business_name: businessName,
                autoposting_enabled: true,
                autoposting_schedule: schedule,
                autoposting_frequency: actualFrequency,
                autoposting_status: 'active',
                autoposting_status_reason: 'Enabled via global time setting',
                updated_at: new Date().toISOString()
              }, { onConflict: 'gmail_id,location_id' });

            if (upsertError) {
              console.error(`[Automation API] ❌ Upsert failed for ${locationId}:`, upsertError);
              results.push({ locationId, businessName, success: false, error: upsertError.message });
              continue;
            }

            // Update in-memory scheduler
            automationScheduler.settings.automations[locationId] = {
              ...config,
              enabled: true,
              autoPosting: {
                ...config?.autoPosting,
                enabled: true,
                schedule,
                frequency: actualFrequency,
                userCustomizedTime: true,
                email: userEmail
              }
            };

            // 🔥 If immediate post requested, trigger post NOW
            if (isImmediatePost) {
              console.log(`[Automation API] ⚡ Triggering IMMEDIATE post for ${businessName} (${locationId})`);
              automationScheduler.triggerImmediatePost(locationId, userEmail, businessName).catch(err => {
                console.error(`[Automation API] ❌ Immediate post failed for ${locationId}:`, err.message);
              });
            }

            console.log(`[Automation API] ✅ Inserted & updated ${businessName} (${locationId})`);
            results.push({ locationId, businessName, success: true, immediatePost: isImmediatePost });
          } catch (error) {
            results.push({ locationId, businessName, success: false, error: error.message });
          }
        }
      }
    } else {
      // Update existing locations in user_locations table
      for (const location of userLocations) {
        const locationId = location.location_id;
        const businessName = location.business_name || 'Unknown';

        try {
          // Update the location in user_locations table
          const { error: updateError } = await supabase
            .from('user_locations')
            .update({
              autoposting_enabled: true,
              autoposting_schedule: schedule,
              autoposting_frequency: actualFrequency,
              autoposting_status: 'active',
              autoposting_status_reason: 'Enabled via global time setting',
              updated_at: new Date().toISOString()
            })
            .eq('gmail_id', userEmail)
            .eq('location_id', locationId);

          if (updateError) {
            console.error(`[Automation API] ❌ Update failed for ${locationId}:`, updateError);
            results.push({ locationId, businessName, success: false, error: updateError.message });
            continue;
          }

          // Also update in-memory scheduler
          automationScheduler.settings.automations = automationScheduler.settings.automations || {};
          automationScheduler.settings.automations[locationId] = {
            ...automationScheduler.settings.automations[locationId],
            enabled: true,
            email: userEmail,
            autoPosting: {
              ...(automationScheduler.settings.automations[locationId]?.autoPosting || {}),
              enabled: true,
              schedule,
              frequency: actualFrequency,
              businessName,
              userCustomizedTime: true,
              email: userEmail
            }
          };

          // Reschedule cron job (for future posts)
          try {
            automationScheduler.stopAutoPosting(locationId);
            automationScheduler.scheduleAutoPosting(locationId, {
              enabled: true,
              schedule,
              frequency: actualFrequency,
              businessName,
              email: userEmail
            });
          } catch (cronError) {
            console.warn(`[Automation API] ⚠️ Cron reschedule warning for ${locationId}:`, cronError.message);
          }

          // 🔥 If immediate post requested, trigger post NOW
          if (isImmediatePost) {
            console.log(`[Automation API] ⚡ Triggering IMMEDIATE post for ${businessName} (${locationId})`);
            automationScheduler.triggerImmediatePost(locationId, userEmail, businessName).catch(err => {
              console.error(`[Automation API] ❌ Immediate post failed for ${locationId}:`, err.message);
            });
          }

          console.log(`[Automation API] ✅ Updated ${businessName} (${locationId}) to post at ${schedule} (${actualFrequency})${isImmediatePost ? ' + IMMEDIATE POST' : ''}`);
          results.push({ locationId, businessName, success: true, immediatePost: isImmediatePost });
        } catch (error) {
          console.error(`[Automation API] ❌ Failed to update ${locationId}:`, error);
          results.push({ locationId, businessName, success: false, error: error.message || 'Unknown error' });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[Automation API] ✅ Global time update complete: ${successCount} success, ${failCount} failed`);

    res.json({
      success: true,
      message: `Updated ${successCount} profile(s) to post at ${schedule}`,
      schedule,
      frequency,
      successCount,
      failCount,
      subscriptionStatus: subscriptionCheck.status,
      results
    });
  } catch (error) {
    console.error('[Automation API] ❌ Global time update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update global posting time',
      details: error.message
    });
  }
});

// ============================================
// SCHEDULED POSTS ENDPOINTS (30-min preview)
// ============================================

// Get all visible scheduled posts (posts that appear 30 min before publishing)
router.get('/scheduled-posts', async (req, res) => {
  try {
    // First, trigger pre-generation check to ensure we have latest
    await scheduledPostsService.preGenerateAllUpcomingPosts();

    // Get visible scheduled posts
    const scheduledPosts = scheduledPostsService.getVisibleScheduledPosts();

    res.json({
      success: true,
      count: scheduledPosts.length,
      posts: scheduledPosts,
      message: scheduledPosts.length > 0
        ? `${scheduledPosts.length} post(s) scheduled and ready to publish`
        : 'No scheduled posts in preview window (posts appear 30 minutes before publishing)'
    });
  } catch (error) {
    console.error('Error getting scheduled posts:', error);
    res.status(500).json({ error: 'Failed to get scheduled posts' });
  }
});

// Get scheduled post for a specific location
router.get('/scheduled-posts/:locationId', (req, res) => {
  try {
    const { locationId } = req.params;
    const post = scheduledPostsService.getScheduledPostForLocation(locationId);

    if (post) {
      res.json({ success: true, post });
    } else {
      res.json({ success: false, message: 'No scheduled post for this location' });
    }
  } catch (error) {
    console.error('Error getting scheduled post:', error);
    res.status(500).json({ error: 'Failed to get scheduled post' });
  }
});

// Force pre-generate all upcoming posts NOW (for testing)
router.post('/scheduled-posts/generate-now', async (req, res) => {
  try {
    console.log('[API] Force pre-generating all scheduled posts...');
    const count = await scheduledPostsService.preGenerateAllUpcomingPosts();

    res.json({
      success: true,
      preGeneratedCount: count,
      visiblePosts: scheduledPostsService.getVisibleScheduledPosts().length,
      message: `Pre-generated ${count} post(s)`
    });
  } catch (error) {
    console.error('Error pre-generating posts:', error);
    res.status(500).json({ error: 'Failed to pre-generate posts' });
  }
});

// Start the scheduled posts pre-generation service
router.post('/scheduled-posts/start-service', (req, res) => {
  try {
    scheduledPostsService.startPreGenerationChecker();
    res.json({
      success: true,
      message: 'Scheduled posts pre-generation service started'
    });
  } catch (error) {
    console.error('Error starting service:', error);
    res.status(500).json({ error: 'Failed to start service' });
  }
});

// 🔄 Reload all automation settings from database (for fixing sync issues)
router.post('/reload', async (req, res) => {
  try {
    console.log('[Automation API] 🔄 Reloading all automation settings from database...');

    // Stop all existing cron jobs
    const existingJobs = Array.from(automationScheduler.scheduledJobs.keys());
    for (const locationId of existingJobs) {
      automationScheduler.stopAutoPosting(locationId);
    }
    console.log(`[Automation API] ⏹️ Stopped ${existingJobs.length} existing cron jobs`);

    // Reload settings from database
    await automationScheduler.loadSettings();

    // Reinitialize all automations
    await automationScheduler.initializeAutomations();

    const automationCount = Object.keys(automationScheduler.settings.automations || {}).length;
    const cronJobCount = automationScheduler.scheduledJobs.size;

    console.log(`[Automation API] ✅ Reload complete: ${automationCount} automations, ${cronJobCount} cron jobs`);

    res.json({
      success: true,
      message: `Reloaded ${automationCount} automation settings`,
      automationCount,
      cronJobCount
    });
  } catch (error) {
    console.error('[Automation API] ❌ Error reloading settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reload settings',
      details: error.message
    });
  }
});

// ============================================
// COMPREHENSIVE HEALTH CHECK ENDPOINT
// ============================================

/**
 * Full diagnostic endpoint to understand why locations may not be running
 * Shows subscription status, token status, and automation status for ALL locations
 */
router.get('/health/full-diagnostic', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseSubscriptionService = (await import('../services/supabaseSubscriptionService.js')).default;
    const subscriptionGuard = (await import('../services/subscriptionGuard.js')).default;
    const supabaseTokenStorage = (await import('../services/supabaseTokenStorage.js')).default;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const diagnostic = {
      timestamp: new Date().toISOString(),
      serverTimeIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      summary: {
        total: 0,
        running: 0,
        blocked: 0,
        disabled: 0,
        noSubscription: 0,
        noToken: 0
      },
      systemHealth: {
        schedulerActive: !!automationScheduler.missedPostCheckerInterval,
        activeCronJobs: automationScheduler.scheduledJobs.size,
        activeReviewMonitors: automationScheduler.reviewCheckIntervals.size,
        inMemoryLocations: Object.keys(automationScheduler.settings.automations || {}).length
      },
      locations: []
    };

    // Get ALL automation settings from database (including disabled)
    const { data: allSettings, error } = await supabase
      .from('automation_settings')
      .select('*');

    if (error) {
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    // Analyze each location
    for (const setting of (allSettings || [])) {
      const locationId = setting.location_id;
      const userId = setting.user_id;
      const settings = setting.settings || {};
      const autoPosting = settings.autoPosting || {};

      const locationDiagnostic = {
        locationId,
        userId,
        businessName: autoPosting.businessName || settings.businessName || 'Unknown',
        status: 'unknown',
        issues: [],
        details: {
          dbEnabled: setting.enabled,
          autoPostingEnabled: autoPosting.enabled,
          autoReplyEnabled: settings.autoReply?.enabled,
          schedule: autoPosting.schedule,
          frequency: autoPosting.frequency,
          lastRun: autoPosting.lastRun,
          disabledReason: settings.disabledReason || null
        }
      };

      diagnostic.summary.total++;

      // Check 1: Is it enabled in database?
      if (!setting.enabled) {
        locationDiagnostic.status = 'disabled';
        locationDiagnostic.issues.push({
          type: 'DISABLED_IN_DB',
          severity: 'high',
          message: `Disabled: ${settings.disabledReason || 'Unknown reason'}`
        });
        diagnostic.summary.disabled++;
      }

      // Check 2: Subscription status
      try {
        const access = await subscriptionGuard.hasValidAccess(userId, settings.gbpAccountId);
        locationDiagnostic.subscription = {
          hasAccess: access.hasAccess,
          status: access.status || access.reason,
          daysRemaining: access.daysRemaining,
          message: access.message
        };

        if (!access.hasAccess) {
          locationDiagnostic.issues.push({
            type: 'SUBSCRIPTION_BLOCKED',
            severity: 'critical',
            message: access.message
          });
          diagnostic.summary.noSubscription++;
        }
      } catch (subError) {
        locationDiagnostic.subscription = { error: subError.message };
        locationDiagnostic.issues.push({
          type: 'SUBSCRIPTION_ERROR',
          severity: 'critical',
          message: 'Could not check subscription status'
        });
      }

      // Check 3: Token availability
      try {
        const token = await supabaseTokenStorage.getUserToken(userId);
        if (token) {
          const now = Date.now();
          const isExpired = token.expiry_date && token.expiry_date < now;
          locationDiagnostic.token = {
            available: true,
            expired: isExpired,
            expiresAt: token.expiry_date ? new Date(token.expiry_date).toISOString() : 'unknown'
          };

          if (isExpired) {
            locationDiagnostic.issues.push({
              type: 'TOKEN_EXPIRED',
              severity: 'high',
              message: 'Token expired, will use pool or need refresh'
            });
          }
        } else {
          locationDiagnostic.token = { available: false };
          locationDiagnostic.issues.push({
            type: 'NO_TOKEN',
            severity: 'high',
            message: 'No token for user, will use shared pool'
          });
          diagnostic.summary.noToken++;
        }
      } catch (tokenError) {
        locationDiagnostic.token = { error: tokenError.message };
      }

      // Check 4: Cron job status
      const hasCronJob = automationScheduler.scheduledJobs.has(locationId);
      const hasReviewMonitor = automationScheduler.reviewCheckIntervals.has(locationId);
      locationDiagnostic.scheduler = {
        hasCronJob,
        hasReviewMonitor
      };

      if (setting.enabled && autoPosting.enabled && !hasCronJob) {
        locationDiagnostic.issues.push({
          type: 'NO_CRON_JOB',
          severity: 'high',
          message: 'Enabled but no cron job scheduled'
        });
      }

      // Determine final status
      if (locationDiagnostic.issues.length === 0) {
        locationDiagnostic.status = 'running';
        diagnostic.summary.running++;
      } else {
        const criticalIssues = locationDiagnostic.issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
          locationDiagnostic.status = 'blocked';
          diagnostic.summary.blocked++;
        } else {
          locationDiagnostic.status = 'warning';
        }
      }

      diagnostic.locations.push(locationDiagnostic);
    }

    // Sort: blocked first, then warnings, then running
    diagnostic.locations.sort((a, b) => {
      const order = { blocked: 0, warning: 1, disabled: 2, running: 3 };
      return (order[a.status] || 4) - (order[b.status] || 4);
    });

    res.json(diagnostic);
  } catch (error) {
    console.error('Error in full diagnostic:', error);
    res.status(500).json({ error: 'Diagnostic failed', details: error.message });
  }
});

/**
 * Admin endpoint to re-enable all disabled locations for a user
 */
router.post('/admin/reenable-locations', async (req, res) => {
  try {
    const { userId, gbpAccountId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const subscriptionGuard = (await import('../services/subscriptionGuard.js')).default;
    const result = await subscriptionGuard.reEnableAllFeatures(userId, gbpAccountId, 'admin_manual_reenable');

    if (result.success) {
      // Reload automation scheduler
      await automationScheduler.loadSettings();
      await automationScheduler.initializeAutomations();

      res.json({
        success: true,
        reenabledCount: result.reenabledCount,
        message: `Re-enabled ${result.reenabledCount} location(s) and reloaded scheduler`
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error re-enabling locations:', error);
    res.status(500).json({ error: 'Failed to re-enable locations', details: error.message });
  }
});

export default router;
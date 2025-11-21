import express from 'express';
import automationScheduler from '../services/automationScheduler.js';

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
        schedule: '09:00',
        frequency: 'alternative',
        businessName: settings.businessName || 'Business',
        category: settings.category || 'business',
        keywords: settings.keywords || 'quality service, customer satisfaction',
        userId: settings.userId || 'default',
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
    
    console.log(`[Automation API] Manually triggering post for location ${locationId}`);
    
    // Get existing automation settings if config is not complete
    const settings = automationScheduler.settings.automations?.[locationId];
    const mergedConfig = {
      ...settings?.autoPosting,
      ...config,
      userId: config.userId || settings?.autoPosting?.userId || 'default'
    };
    
    await automationScheduler.createAutomatedPost(locationId, mergedConfig);
    
    res.json({ success: true, message: 'Post triggered successfully' });
  } catch (error) {
    console.error('Error triggering post:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger post' });
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
          schedule: '09:00',
          frequency: 'alternative', // Every 2 days
          businessName: businessName || 'Business',
          category: category || 'business',
          keywords: keywords || 'quality service, customer satisfaction, professional',
          websiteUrl: websiteUrl || '',
          locationName: locationName || '',
          timezone: 'America/New_York',
          userId: 'default'
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
          schedule: '09:00',
          frequency: 'alternative',
          businessName: businessName || 'Business',
          category: category || 'business',
          keywords: keywords || 'quality service, customer satisfaction, professional',
          userId: 'default'
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
        timezone: config?.timezone || 'America/New_York'
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

export default router;
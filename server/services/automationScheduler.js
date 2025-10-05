import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import firestoreTokenStorage from './firestoreTokenStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AutomationScheduler {
  constructor() {
    this.dataFile = path.join(__dirname, '..', 'data', 'automationSettings.json');
    this.tokenFile = path.join(__dirname, '..', 'data', 'tokens.json');
    this.ensureDataFiles();
    this.loadSettings();
    this.scheduledJobs = new Map();
    this.reviewCheckIntervals = new Map();
    
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

  ensureDataFiles() {
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dataFile)) {
      this.saveSettings({ automations: {} });
    }
    if (!fs.existsSync(this.tokenFile)) {
      fs.writeFileSync(this.tokenFile, JSON.stringify({ tokens: {} }, null, 2));
    }
  }

  loadSettings() {
    try {
      const data = fs.readFileSync(this.dataFile, 'utf8');
      this.settings = JSON.parse(data);
      console.log('[AutomationScheduler] Loaded automation settings');
    } catch (error) {
      console.error('[AutomationScheduler] Error loading settings:', error);
      this.settings = { automations: {} };
    }
  }

  saveSettings(settings = this.settings) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(settings, null, 2));
      console.log('[AutomationScheduler] Saved automation settings');
    } catch (error) {
      console.error('[AutomationScheduler] Error saving settings:', error);
    }
  }

  loadTokens() {
    // Use centralized token storage
    // Load tokens from Firestore - this is handled differently now
    // We'll use getValidToken directly instead
    return {};
  }

  // Get valid token for user with automatic refresh
  async getValidTokenForUser(userId) {
    return await firestoreTokenStorage.getValidToken(userId);
  }

  // Initialize all automation schedules
  initializeAutomations() {
    console.log('[AutomationScheduler] Initializing all automations...');
    
    const automations = this.settings.automations || {};
    for (const [locationId, config] of Object.entries(automations)) {
      if (config.autoPosting?.enabled) {
        this.scheduleAutoPosting(locationId, config.autoPosting);
      }
      if (config.autoReply?.enabled) {
        this.startReviewMonitoring(locationId, config.autoReply);
      }
    }
    
    console.log(`[AutomationScheduler] Initialized ${this.scheduledJobs.size} posting schedules and ${this.reviewCheckIntervals.size} review monitors`);
  }

  // Update automation settings
  updateAutomationSettings(locationId, settings) {
    console.log(`[AutomationScheduler] Updating settings for location ${locationId}`);
    
    if (!this.settings.automations) {
      this.settings.automations = {};
    }
    
    this.settings.automations[locationId] = {
      ...this.settings.automations[locationId],
      ...settings,
      updatedAt: new Date().toISOString()
    };
    
    this.saveSettings();
    
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
    switch (config.frequency) {
      case 'daily':
        // Daily at specified time (e.g., "09:00")
        const [hour, minute] = config.schedule.split(':');
        cronExpression = `${minute} ${hour} * * *`;
        break;
      case 'alternative':
        // Every other day at specified time
        const [altHour, altMinute] = config.schedule.split(':');
        // Use */2 for every 2 days
        cronExpression = `${altMinute} ${altHour} */2 * *`;
        break;
      case 'weekly':
        // Weekly on specified day and time
        const weekDay = config.dayOfWeek || 1; // Default Monday
        const [wHour, wMinute] = config.schedule.split(':');
        cronExpression = `${wMinute} ${wHour} * * ${weekDay}`;
        break;
      case 'twice-weekly':
        // Twice weekly (Monday and Thursday)
        const [twHour, twMinute] = config.schedule.split(':');
        cronExpression = `${twMinute} ${twHour} * * 1,4`;
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

    const job = cron.schedule(cronExpression, async () => {
      console.log(`[AutomationScheduler] Running scheduled post for location ${locationId}`);
      await this.createAutomatedPost(locationId, config);
    }, {
      scheduled: true,
      timezone: config.timezone || 'America/New_York'
    });

    this.scheduledJobs.set(locationId, job);
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
      const postContent = await this.generatePostContent(config);
      
      // Create the post via Google Business Profile API (v1 - current version)
      // Updated API endpoint for Google Business Profile API v1
      const postUrl = `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}/localPosts`;
      console.log(`[AutomationScheduler] Posting to URL: ${postUrl}`);
      
      const postData = {
        languageCode: 'en',
        summary: postContent.content,
        topicType: config.topicType || 'STANDARD'
      };

      // Add call to action if provided from the client
      if (postContent.callToAction) {
        postData.callToAction = postContent.callToAction;
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
          postId: result.name || result.id,
          content: postContent.content,
          timestamp: new Date().toISOString()
        });
        
        return result; // Return success result
      } else {
        const error = await response.text();
        console.error(`[AutomationScheduler] ❌ Failed to create post for location ${locationId}:`, error);
        
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
      
      const response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          languageCode: 'en',
          summary: postContent.content,
          callToAction: postContent.callToAction,
          topicType: config.topicType || 'STANDARD'
        })
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
      return await this.createAutomatedPostWithToken(locationId, config, userToken.access_token);

    } catch (error) {
      console.error(`[AutomationScheduler] ❌ Error creating automated post:`, error);
      console.error(`[AutomationScheduler] Error stack:`, error.stack);

      // Log the error
      this.logAutomationActivity(locationId, 'post_failed', {
        error: error.message,
        timestamp: new Date().toISOString(),
        reason: 'system_error',
        errorStack: error.stack
      });

      return null;
    }
  }

  // Generate post content using AI ONLY - no templates/mocks
  async generatePostContent(config) {
    // Ensure we have proper business name and details
    const businessName = config.businessName || 'Business';
    const category = config.category || 'service';
    const keywords = config.keywords || 'quality, service, professional';
    const city = config.city || config.locationName || '';
    const region = config.region || '';
    const country = config.country || '';
    const fullAddress = config.fullAddress || '';
    const websiteUrl = config.websiteUrl || '';
    const postalCode = config.postalCode || config.pinCode || '';

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
    
    console.log(`[AutomationScheduler] Generating AI content for: ${businessName}`);
    console.log(`[AutomationScheduler] Category: ${category}`);
    console.log(`[AutomationScheduler] Keywords: ${keywords}`);
    console.log(`[AutomationScheduler] Location: ${locationStr}`);
    console.log(`[AutomationScheduler] Complete Address: ${completeAddress}`);
    console.log(`[AutomationScheduler] Website: ${websiteUrl}`);
    
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

        return {
          content
          // Note: callToAction is now handled by the frontend automation service
          // based on user's button configuration preferences
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
      
      try {
        // Try Google Business Profile API v1 first
        console.log(`[AutomationScheduler] Fetching reviews using modern API for location ${locationId}...`);
        response = await fetch(
          `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}/reviews`,
          {
            headers: {
              'Authorization': `Bearer ${userToken.access_token}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          reviews = data.reviews || [];
          console.log(`[AutomationScheduler] ✅ Modern API: Found ${reviews.length} reviews`);
        } else {
          throw new Error(`Modern API failed with status: ${response.status}`);
        }
      } catch (error) {
        console.log(`[AutomationScheduler] 🔄 Modern API failed, trying fallback...`);
        
        // Fallback to older API
        const accountId = config.accountId || '106433552101751461082';
        response = await fetch(
          `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
          {
            headers: {
              'Authorization': `Bearer ${userToken.access_token}`
            }
          }
        );

        if (!response.ok) {
          console.error(`[AutomationScheduler] ❌ Both APIs failed to fetch reviews:`, await response.text());
          return;
        }

        const data = await response.json();
        reviews = data.reviews || [];
        console.log(`[AutomationScheduler] ✅ Fallback API: Found ${reviews.length} reviews`);
      }
      
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
          const rating = review.starRating?.value || review.starRating || 'Unknown';
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
    const rating = review.starRating?.value || 0;
    
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
      const rating = review.starRating?.value || review.starRating;
      const reviewerName = review.reviewer?.displayName || 'Unknown';
      
      console.log(`[AutomationScheduler] 🤖 AUTO-GENERATING AI REPLY for review ${reviewId}`);
      console.log(`[AutomationScheduler] 📊 Review details: ${rating} stars from ${reviewerName}`);
      
      // Generate reply using AI - FULLY AUTOMATIC
      const replyText = await this.generateReviewReply(review, config);
      console.log(`[AutomationScheduler] 💬 Generated reply: "${replyText.substring(0, 100)}..."`);
      
      // Send reply via Google Business Profile API - try modern endpoint first
      let success = false;
      
      try {
        // Try Google Business Profile API v1 first
        console.log(`[AutomationScheduler] Attempting to reply using modern API...`);
        const modernResponse = await fetch(
          `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}/reviews/${reviewId}/reply`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              comment: replyText
            })
          }
        );

        if (modernResponse.ok) {
          console.log(`[AutomationScheduler] ✅ Modern API: Successfully replied to review ${reviewId}`);
          success = true;
        } else {
          throw new Error(`Modern API failed with status: ${modernResponse.status}`);
        }
      } catch (error) {
        console.log(`[AutomationScheduler] 🔄 Modern API failed, trying fallback...`);
        
        // Fallback to older API
        const accountId = config.accountId || '106433552101751461082';
        const fallbackResponse = await fetch(
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

        if (fallbackResponse.ok) {
          console.log(`[AutomationScheduler] ✅ Fallback API: Successfully replied to review ${reviewId}`);
          success = true;
        } else {
          const error = await fallbackResponse.text();
          console.error(`[AutomationScheduler] ❌ Both APIs failed to reply to review:`, error);
        }
      }

      if (success) {
        // Mark review as replied
        this.markReviewAsReplied(locationId, reviewId);
        
        // Log the activity
        this.logAutomationActivity(locationId, 'review_replied', {
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
        reviewId: review.reviewId || review.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Generate review reply using AI ONLY - no templates
  async generateReviewReply(review, config) {
    const rating = review.starRating?.value || 0;
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
      
      const prompt = `Generate a completely unique and personalized reply to this Google Business review for "${businessName}" (${category}):
      
Reviewer Name: ${reviewerName}
Rating: ${rating}/5 stars
Review Text: "${reviewText}"
Business Keywords/Strengths: ${keywordList.length > 0 ? keywordList.join(', ') : 'quality service, customer satisfaction'}
Current Month: ${currentMonth}
Random Seed: ${randomSeed}

STRICT Requirements:
1. Write EXACTLY 80-120 words
2. Use a ${tone} tone
3. Address the reviewer by name if appropriate
4. Specifically reference something they mentioned in their review
5. If positive, subtly mention one of our business keywords/strengths when relevant
6. Thank them genuinely and personally
7. If negative, apologize sincerely and offer to make things right
8. End with an invitation for future visits or continued relationship
9. Make it feel personal and human, not automated
10. NO generic phrases or template language
11. Each reply must be completely unique and natural`;

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

  // Log automation activities
  logAutomationActivity(locationId, type, details) {
    const logFile = path.join(__dirname, '..', 'data', 'automation_log.json');
    let log = { activities: [] };
    
    try {
      if (fs.existsSync(logFile)) {
        log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
      
      log.activities.push({
        locationId,
        type,
        details,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 1000 activities
      if (log.activities.length > 1000) {
        log.activities = log.activities.slice(-1000);
      }
      
      fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
    } catch (error) {
      console.error('[AutomationScheduler] Error logging activity:', error);
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
    
    console.log('[AutomationScheduler] All automations stopped');
  }
}

// Create singleton instance
const automationScheduler = new AutomationScheduler();

// Initialize automations on startup
automationScheduler.initializeAutomations();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[AutomationScheduler] Shutting down gracefully...');
  automationScheduler.stopAllAutomations();
  process.exit(0);
});

export default automationScheduler;
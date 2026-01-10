import supabaseConfig from '../config/supabase.js';

/**
 * Supabase Automation Service
 * UPDATED: Now uses the NEW schema (users + user_locations tables)
 * instead of the old automation_settings table
 */
class SupabaseAutomationService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized && this.client) {
      return this.client;
    }

    try {
      this.client = await supabaseConfig.ensureInitialized();
      this.initialized = true;
      return this.client;
    } catch (error) {
      console.error('[SupabaseAutomationService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Save automation settings to user_locations table
   */
  async saveSettings(userId, locationId, settings) {
    try {
      await this.initialize();

      // Validate locationId is provided
      if (!locationId || locationId === 'undefined' || locationId === 'null') {
        console.warn(`[SupabaseAutomationService] ⚠️ Skipping save - invalid location_id: ${locationId} for user: ${userId}`);
        return settings;
      }

      console.log(`[SupabaseAutomationService] 💾 Saving settings for userId: ${userId}, locationId: ${locationId}`);

      // First, find the gmail_id for this user (userId might be firebase_uid or gmail)
      let gmailId = userId;
      if (!userId.includes('@')) {
        const { data: user } = await this.client
          .from('users')
          .select('gmail_id')
          .eq('firebase_uid', userId)
          .single();

        if (user) {
          gmailId = user.gmail_id;
        }
      }

      // Update the user_locations table
      const updateData = {
        autoposting_enabled: settings.autoPosting?.enabled ?? settings.enabled ?? true,
        autoposting_schedule: settings.autoPosting?.schedule || '10:00',
        autoposting_frequency: settings.autoPosting?.frequency || 'daily',
        autoposting_timezone: settings.autoPosting?.timezone || 'Asia/Kolkata',
        autoreply_enabled: settings.autoReply?.enabled ?? settings.autoReplyEnabled ?? false,
        keywords: settings.autoPosting?.keywords || settings.keywords || null,
        updated_at: new Date().toISOString()
      };

      // Update lastRun if provided
      if (settings.autoPosting?.lastRun) {
        updateData.last_post_date = settings.autoPosting.lastRun;
      }

      const { error } = await this.client
        .from('user_locations')
        .update(updateData)
        .eq('location_id', locationId);

      if (error) {
        console.error(`[SupabaseAutomationService] ❌ Error updating location:`, error);
        throw error;
      }

      console.log(`[SupabaseAutomationService] ✅ Settings saved for location: ${locationId}`);
      return settings;
    } catch (error) {
      console.error('[SupabaseAutomationService] Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Get automation settings for a specific location
   */
  async getSettings(userId, locationId) {
    try {
      await this.initialize();

      console.log(`[SupabaseAutomationService] 🔍 Fetching settings for locationId: ${locationId}`);

      const { data, error } = await this.client
        .from('user_locations')
        .select('*, users!inner(gmail_id, firebase_uid, google_access_token, google_refresh_token, google_token_expiry, subscription_status, trial_end_date, subscription_end_date, is_admin, has_valid_token)')
        .eq('location_id', locationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[SupabaseAutomationService] ⚠️ No settings found for location: ${locationId}`);
          return null;
        }
        throw error;
      }

      return this.formatSettingsFromNewSchema(data);
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting settings:', error);
      return null;
    }
  }

  /**
   * Get all automation settings for a user
   */
  async getAllSettingsForUser(userId) {
    try {
      await this.initialize();

      // Find gmail_id if userId is firebase_uid
      let gmailId = userId;
      if (!userId.includes('@')) {
        const { data: user } = await this.client
          .from('users')
          .select('gmail_id')
          .eq('firebase_uid', userId)
          .single();

        if (user) {
          gmailId = user.gmail_id;
        }
      }

      const { data, error } = await this.client
        .from('user_locations')
        .select('*, users!inner(gmail_id, firebase_uid, google_access_token, google_refresh_token, google_token_expiry, subscription_status, trial_end_date, subscription_end_date, is_admin, has_valid_token)')
        .eq('gmail_id', gmailId);

      if (error) throw error;

      return (data || []).map(d => this.formatSettingsFromNewSchema(d));
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting all settings:', error);
      return [];
    }
  }

  /**
   * Get ALL automations for the scheduler
   * Loads from user_locations table joined with users for token info
   */
  async getAllEnabledAutomations() {
    try {
      await this.initialize();

      console.log('[SupabaseAutomationService] 📥 Loading ALL automation settings from user_locations table...');

      // Join user_locations with users to get token and subscription info
      const { data, error } = await this.client
        .from('user_locations')
        .select(`
          *,
          users!inner(
            gmail_id,
            firebase_uid,
            display_name,
            google_access_token,
            google_refresh_token,
            google_token_expiry,
            subscription_status,
            trial_end_date,
            subscription_end_date,
            is_admin,
            has_valid_token
          )
        `)
        .eq('autoposting_enabled', true);

      if (error) {
        console.error('[SupabaseAutomationService] ❌ Error loading automations:', error);
        throw error;
      }

      console.log(`[SupabaseAutomationService] ✅ Loaded ${(data || []).length} locations with auto-posting enabled`);

      // Transform to the format expected by automationScheduler
      const formattedData = (data || []).map(d => this.formatSettingsFromNewSchema(d));

      // Log details
      formattedData.forEach((d, i) => {
        console.log(`[SupabaseAutomationService]   ${i + 1}. ${d.businessName || d.locationId} - Schedule: ${d.autoPosting?.schedule || '10:00'}`);
      });

      return formattedData;
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting enabled automations:', error);
      return [];
    }
  }

  /**
   * Format settings from NEW schema (user_locations + users) to old format
   * This ensures compatibility with existing automationScheduler code
   */
  formatSettingsFromNewSchema(data) {
    if (!data) return null;

    const user = data.users || {};

    return {
      // Location identifiers
      locationId: data.location_id,
      userId: user.gmail_id || data.gmail_id,
      firebaseUid: user.firebase_uid,

      // Business info
      businessName: data.business_name,
      category: data.category || 'business',
      keywords: data.keywords,

      // Enable flags
      enabled: data.autoposting_enabled,
      autoReplyEnabled: data.autoreply_enabled,

      // Auto-posting config (format expected by automationScheduler)
      autoPosting: {
        enabled: data.autoposting_enabled,
        schedule: data.autoposting_schedule || '10:00',
        frequency: data.autoposting_frequency || 'daily',
        timezone: data.autoposting_timezone || 'Asia/Kolkata',
        lastRun: data.last_post_date,
        businessName: data.business_name,
        keywords: data.keywords,
        category: data.category || 'business',
        userId: user.gmail_id || data.gmail_id,
        gbpAccountId: process.env.HARDCODED_ACCOUNT_ID || '106433552101751461082'
      },

      // Auto-reply config
      autoReply: {
        enabled: data.autoreply_enabled,
        replyTone: 'professional',
        replyLanguage: 'en'
      },

      // Token info (from users table)
      accessToken: user.google_access_token,
      refreshToken: user.google_refresh_token,
      tokenExpiry: user.google_token_expiry,
      hasValidToken: user.has_valid_token,

      // Subscription info
      subscriptionStatus: user.subscription_status,
      trialEndDate: user.trial_end_date,
      subscriptionEndDate: user.subscription_end_date,
      isAdmin: user.is_admin,

      // Timestamps
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Log automation activity
   * Creates a log entry (can be stored in a separate table or just console log for now)
   */
  async logActivity(userId, locationId, actionType, reviewId, status, details, errorMessage = null) {
    try {
      await this.initialize();

      // Update the user_locations table with post info
      if (actionType === 'post_created' && status === 'success') {
        // First get current count
        const { data: current } = await this.client
          .from('user_locations')
          .select('total_posts_created')
          .eq('location_id', locationId)
          .single();

        const newCount = (current?.total_posts_created || 0) + 1;

        await this.client
          .from('user_locations')
          .update({
            last_post_date: new Date().toISOString(),
            last_post_success: true,
            last_post_error: null,
            total_posts_created: newCount
          })
          .eq('location_id', locationId);

        console.log(`[SupabaseAutomationService] 📝 Post count updated: ${newCount} for location ${locationId}`);
      } else if (actionType === 'post_failed') {
        await this.client
          .from('user_locations')
          .update({
            last_post_success: false,
            last_post_error: errorMessage || details?.error || 'Unknown error'
          })
          .eq('location_id', locationId);
      }

      console.log(`[SupabaseAutomationService] 📝 Activity logged: ${actionType} for ${locationId} - ${status}`);
      return true;
    } catch (error) {
      console.error('[SupabaseAutomationService] Error logging activity:', error);
      return false;
    }
  }

  /**
   * Get automation logs (simplified - returns recent activity from user_locations)
   */
  async getAutomationLogs(userId, limit = 100) {
    try {
      await this.initialize();

      // Find gmail_id if needed
      let gmailId = userId;
      if (!userId.includes('@')) {
        const { data: user } = await this.client
          .from('users')
          .select('gmail_id')
          .eq('firebase_uid', userId)
          .single();

        if (user) {
          gmailId = user.gmail_id;
        }
      }

      // Return location activity as logs
      const { data, error } = await this.client
        .from('user_locations')
        .select('location_id, business_name, last_post_date, last_post_success, last_post_error, total_posts_created')
        .eq('gmail_id', gmailId)
        .order('last_post_date', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(d => ({
        locationId: d.location_id,
        businessName: d.business_name,
        lastPostDate: d.last_post_date,
        success: d.last_post_success,
        error: d.last_post_error,
        totalPosts: d.total_posts_created
      }));
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting logs:', error);
      return [];
    }
  }

  /**
   * Get posts created for user within timeframe
   */
  async getPostsCreated(userId, startDate, endDate = null) {
    // Simplified - return count from user_locations
    try {
      await this.initialize();

      let gmailId = userId;
      if (!userId.includes('@')) {
        const { data: user } = await this.client
          .from('users')
          .select('gmail_id')
          .eq('firebase_uid', userId)
          .single();

        if (user) gmailId = user.gmail_id;
      }

      let query = this.client
        .from('user_locations')
        .select('*')
        .eq('gmail_id', gmailId)
        .gte('last_post_date', startDate.toISOString());

      if (endDate) {
        query = query.lte('last_post_date', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting posts created:', error);
      return [];
    }
  }

  /**
   * Get reviews replied for user within timeframe
   */
  async getReviewsReplied(userId, startDate, endDate = null) {
    // Placeholder - reviews not tracked in new schema yet
    return [];
  }
}

// Create singleton instance
const supabaseAutomationService = new SupabaseAutomationService();

export default supabaseAutomationService;

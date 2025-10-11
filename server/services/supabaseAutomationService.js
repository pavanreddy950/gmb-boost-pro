import supabaseConfig from '../config/supabase.js';

/**
 * Supabase Automation Service
 * Stores automation settings and logs in PostgreSQL
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
   * Save automation settings
   */
  async saveSettings(userId, locationId, settings) {
    try {
      await this.initialize();

      const record = {
        user_id: userId,
        location_id: locationId,
        enabled: settings.enabled !== false,
        auto_reply_enabled: settings.autoReplyEnabled || false,
        reply_tone: settings.replyTone || 'professional',
        reply_language: settings.replyLanguage || 'en',
        custom_instructions: settings.customInstructions,
        settings: settings, // Store full settings as JSONB
        updated_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from('automation_settings')
        .upsert(record, {
          onConflict: 'user_id, location_id'
        });

      if (error) throw error;

      console.log(`[SupabaseAutomationService] ✅ Saved settings for location: ${locationId}`);
      return settings;
    } catch (error) {
      console.error('[SupabaseAutomationService] Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Get automation settings
   */
  async getSettings(userId, locationId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('automation_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('location_id', locationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.formatSettings(data);
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting settings:', error);
      return null;
    }
  }

  /**
   * Get all automation settings for user
   */
  async getAllSettingsForUser(userId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('automation_settings')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      return (data || []).map(s => this.formatSettings(s));
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting all settings:', error);
      return [];
    }
  }

  /**
   * Get all enabled automations (for scheduler)
   */
  async getAllEnabledAutomations() {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('automation_settings')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      return (data || []).map(s => this.formatSettings(s));
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting enabled automations:', error);
      return [];
    }
  }

  /**
   * Log automation activity
   */
  async logActivity(userId, locationId, actionType, reviewId, status, details, errorMessage = null) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('automation_logs')
        .insert({
          user_id: userId,
          location_id: locationId,
          action_type: actionType,
          review_id: reviewId,
          status: status,
          details: details || {},
          error_message: errorMessage
        });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('[SupabaseAutomationService] Error logging activity:', error);
      return false;
    }
  }

  /**
   * Get automation logs
   */
  async getAutomationLogs(userId, limit = 100) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('automation_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[SupabaseAutomationService] Error getting logs:', error);
      return [];
    }
  }

  /**
   * Format settings from database
   */
  formatSettings(data) {
    if (!data) return null;

    return {
      userId: data.user_id,
      locationId: data.location_id,
      enabled: data.enabled,
      autoReplyEnabled: data.auto_reply_enabled,
      replyTone: data.reply_tone,
      replyLanguage: data.reply_language,
      customInstructions: data.custom_instructions,
      ...data.settings, // Merge full settings object
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
}

// Create singleton instance
const supabaseAutomationService = new SupabaseAutomationService();

export default supabaseAutomationService;





import supabaseConfig from '../config/supabase.js';

class SupabaseUserMappingService {
  constructor() {
    this.client = null;
  }

  async initialize() {
    try {
      await supabaseConfig.ensureInitialized();
      this.client = supabaseConfig.getClient();
      console.log('[SupabaseUserMappingService] ✅ Initialized');
      return true;
    } catch (error) {
      console.error('[SupabaseUserMappingService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get all user-GBP mappings
   * Returns format: { userToGbpMapping: {}, gbpToUserMapping: {} }
   */
  async getAllMappings() {
    try {
      await this.initialize();

      const { data: mappings, error } = await this.client
        .from('user_gbp_mapping')
        .select('*');

      if (error) throw error;

      // Convert array to the expected object format
      const userToGbpMapping = {};
      const gbpToUserMapping = {};

      (mappings || []).forEach(mapping => {
        userToGbpMapping[mapping.user_id] = mapping.gbp_account_id;
        gbpToUserMapping[mapping.gbp_account_id] = mapping.user_id;
      });

      return {
        userToGbpMapping,
        gbpToUserMapping
      };
    } catch (error) {
      console.error('[SupabaseUserMappingService] Error getting mappings:', error);
      return { userToGbpMapping: {}, gbpToUserMapping: {} };
    }
  }

  /**
   * Get GBP account ID for a user
   */
  async getGbpForUser(userId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_gbp_mapping')
        .select('gbp_account_id')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data?.gbp_account_id || null;
    } catch (error) {
      console.error(`[SupabaseUserMappingService] Error getting GBP for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get user ID for a GBP account
   */
  async getUserForGbp(gbpAccountId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_gbp_mapping')
        .select('user_id')
        .eq('gbp_account_id', gbpAccountId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data?.user_id || null;
    } catch (error) {
      console.error(`[SupabaseUserMappingService] Error getting user for GBP ${gbpAccountId}:`, error);
      return null;
    }
  }

  /**
   * Save or update user-GBP mapping
   */
  async saveMapping(userId, gbpAccountId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_gbp_mapping')
        .upsert({
          user_id: userId,
          gbp_account_id: gbpAccountId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[SupabaseUserMappingService] ✅ Saved mapping: ${userId} -> ${gbpAccountId}`);
      return data;
    } catch (error) {
      console.error('[SupabaseUserMappingService] Error saving mapping:', error);
      throw error;
    }
  }

  /**
   * Delete mapping for a user
   */
  async deleteMapping(userId) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('user_gbp_mapping')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      console.log(`[SupabaseUserMappingService] ✅ Deleted mapping for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('[SupabaseUserMappingService] Error deleting mapping:', error);
      throw error;
    }
  }
}

export default new SupabaseUserMappingService();

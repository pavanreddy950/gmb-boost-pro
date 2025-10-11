import supabaseConfig from '../config/supabase.js';

/**
 * Supabase Audit Service
 * Stores audit logs and results in PostgreSQL
 */
class SupabaseAuditService {
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
      console.error('[SupabaseAuditService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Log admin action
   */
  async logAction(adminEmail, action, targetUserEmail, targetUserId, details, req) {
    try {
      await this.initialize();

      const logEntry = {
        admin_email: adminEmail,
        action: action,
        target_user_email: targetUserEmail,
        target_user_id: targetUserId,
        details: details || {},
        ip_address: req?.ip || req?.connection?.remoteAddress,
        user_agent: req?.headers?.['user-agent']
      };

      const { error } = await this.client
        .from('audit_logs')
        .insert(logEntry);

      if (error) throw error;

      console.log(`[SupabaseAuditService] ✅ Logged action: ${action} by ${adminEmail}`);
      return true;
    } catch (error) {
      console.error('[SupabaseAuditService] Error logging action:', error);
      return false;
    }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(limit = 100, offset = 0) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[SupabaseAuditService] Error getting audit logs:', error);
      return [];
    }
  }

  /**
   * Save audit result
   */
  async saveAuditResult(locationId, userId, auditData, score) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('audit_results')
        .insert({
          location_id: locationId,
          user_id: userId,
          audit_data: auditData,
          score: score
        });

      if (error) throw error;

      console.log(`[SupabaseAuditService] ✅ Saved audit result for location: ${locationId}`);
      return true;
    } catch (error) {
      console.error('[SupabaseAuditService] Error saving audit result:', error);
      return false;
    }
  }

  /**
   * Get audit results for location
   */
  async getAuditResults(locationId, limit = 10) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('audit_results')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[SupabaseAuditService] Error getting audit results:', error);
      return [];
    }
  }
}

// Create singleton instance
const supabaseAuditService = new SupabaseAuditService();

export default supabaseAuditService;





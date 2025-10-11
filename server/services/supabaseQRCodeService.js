import supabaseConfig from '../config/supabase.js';

/**
 * Supabase QR Code Service
 * Stores QR codes in PostgreSQL
 */
class SupabaseQRCodeService {
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
      console.error('[SupabaseQRCodeService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Save QR code
   */
  async saveQRCode(qrCodeData) {
    try {
      await this.initialize();

      const record = {
        code: qrCodeData.code,
        location_id: qrCodeData.locationId,
        user_id: qrCodeData.userId,
        place_id: qrCodeData.placeId,
        qr_data_url: qrCodeData.qrDataUrl,
        review_link: qrCodeData.reviewLink,
        scans: qrCodeData.scans || 0,
        last_scanned_at: qrCodeData.lastScannedAt,
        created_at: qrCodeData.createdAt || new Date().toISOString()
      };

      const { error } = await this.client
        .from('qr_codes')
        .upsert(record, { onConflict: 'code' });

      if (error) throw error;

      console.log(`[SupabaseQRCodeService] ✅ Saved QR code: ${qrCodeData.code}`);
      return qrCodeData;
    } catch (error) {
      console.error('[SupabaseQRCodeService] Error saving QR code:', error);
      throw error;
    }
  }

  /**
   * Get QR code by code
   */
  async getQRCode(code) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('qr_codes')
        .select('*')
        .eq('code', code)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.formatQRCode(data);
    } catch (error) {
      console.error('[SupabaseQRCodeService] Error getting QR code:', error);
      return null;
    }
  }

  /**
   * Get all QR codes for user
   */
  async getQRCodesForUser(userId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('qr_codes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(qr => this.formatQRCode(qr));
    } catch (error) {
      console.error('[SupabaseQRCodeService] Error getting QR codes:', error);
      return [];
    }
  }

  /**
   * Increment scan count
   */
  async incrementScanCount(code) {
    try {
      await this.initialize();

      const { data: current } = await this.client
        .from('qr_codes')
        .select('scans')
        .eq('code', code)
        .single();

      const newScans = (current?.scans || 0) + 1;

      const { error } = await this.client
        .from('qr_codes')
        .update({
          scans: newScans,
          last_scanned_at: new Date().toISOString()
        })
        .eq('code', code);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('[SupabaseQRCodeService] Error incrementing scan:', error);
      return false;
    }
  }

  /**
   * Format QR code from database
   */
  formatQRCode(qr) {
    if (!qr) return null;

    return {
      code: qr.code,
      locationId: qr.location_id,
      userId: qr.user_id,
      placeId: qr.place_id,
      qrDataUrl: qr.qr_data_url,
      reviewLink: qr.review_link,
      scans: qr.scans,
      lastScannedAt: qr.last_scanned_at,
      createdAt: qr.created_at
    };
  }
}

// Create singleton instance
const supabaseQRCodeService = new SupabaseQRCodeService();

export default supabaseQRCodeService;





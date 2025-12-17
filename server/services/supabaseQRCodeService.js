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
        location_name: qrCodeData.locationName || null,
        address: qrCodeData.address || null,
        user_id: qrCodeData.userId,
        place_id: qrCodeData.placeId || null,
        qr_data_url: qrCodeData.qrDataUrl || null,
        review_link: qrCodeData.reviewLink || null,
        public_review_url: qrCodeData.publicReviewUrl || null,
        keywords: qrCodeData.keywords || null,
        business_category: qrCodeData.businessCategory || null,
        scans: qrCodeData.scans || 0,
        last_scanned_at: qrCodeData.lastScannedAt || null,
        created_at: qrCodeData.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from('qr_codes')
        .upsert(record, { onConflict: 'code' });

      if (error) throw error;

      console.log(`[SupabaseQRCodeService] ✅ Saved QR code: ${qrCodeData.code} (${qrCodeData.locationName || 'Unknown'}) with keywords: ${qrCodeData.keywords || 'none'}`);
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
   * Update review link for existing QR code
   */
  async updateReviewLink(locationId, googleReviewLink) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('qr_codes')
        .update({
          review_link: googleReviewLink,
          updated_at: new Date().toISOString()
        })
        .eq('code', locationId)
        .select()
        .single();

      if (error) throw error;

      console.log(`[SupabaseQRCodeService] ✅ Updated review link for: ${locationId}`);
      return this.formatQRCode(data);
    } catch (error) {
      console.error('[SupabaseQRCodeService] Error updating review link:', error);
      throw error;
    }
  }

  /**
   * Delete QR code by code
   */
  async deleteQRCode(code) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('qr_codes')
        .delete()
        .eq('code', code);

      if (error) throw error;

      console.log(`[SupabaseQRCodeService] ✅ Deleted QR code: ${code}`);
      return true;
    } catch (error) {
      console.error('[SupabaseQRCodeService] Error deleting QR code:', error);
      return false;
    }
  }

  /**
   * Get QR code statuses for multiple locations
   */
  async getQRCodeStatuses(locationIds) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('qr_codes')
        .select('code, location_id, review_link, created_at')
        .in('code', locationIds);

      if (error) throw error;

      const statuses = {};
      locationIds.forEach(locationId => {
        const qrData = data?.find(qr => qr.code === locationId);
        statuses[locationId] = {
          hasQRCode: !!qrData,
          hasReviewLink: !!(qrData?.review_link),
          createdAt: qrData?.created_at || null,
          locationName: qrData?.location_id || null
        };
      });

      return statuses;
    } catch (error) {
      console.error('[SupabaseQRCodeService] Error getting QR code statuses:', error);
      return {};
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
      locationName: qr.location_name || '',
      address: qr.address || '',
      userId: qr.user_id,
      placeId: qr.place_id || '',
      qrCodeUrl: qr.qr_data_url || '',
      qrDataUrl: qr.qr_data_url || '', // Keep both for compatibility
      googleReviewLink: qr.review_link || '',
      reviewLink: qr.review_link || '', // Keep both for compatibility
      publicReviewUrl: qr.public_review_url || '',
      keywords: qr.keywords || '',
      businessCategory: qr.business_category || null,
      scans: qr.scans || 0,
      lastScannedAt: qr.last_scanned_at,
      createdAt: qr.created_at,
      updatedAt: qr.updated_at
    };
  }
}

// Create singleton instance
const supabaseQRCodeService = new SupabaseQRCodeService();

export default supabaseQRCodeService;





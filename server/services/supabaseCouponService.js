import supabaseConfig from '../config/supabase.js';

/**
 * Supabase Coupon Service
 * Stores coupons and usage tracking in PostgreSQL
 */
class SupabaseCouponService {
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
      console.error('[SupabaseCouponService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Save coupon
   */
  async saveCoupon(couponData) {
    try {
      await this.initialize();

      const record = {
        code: couponData.code,
        discount_type: couponData.discountType,
        discount_value: couponData.discountValue,
        max_uses: couponData.maxUses,
        used_count: couponData.usedCount || 0,
        valid_from: couponData.validFrom,
        valid_until: couponData.validUntil,
        applicable_plans: couponData.applicablePlans || [],
        is_active: couponData.isActive !== false,
        single_use: couponData.singleUse || false,
        created_by: couponData.createdBy,
        created_at: couponData.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from('coupons')
        .upsert(record, { onConflict: 'code' });

      if (error) throw error;

      console.log(`[SupabaseCouponService] ✅ Saved coupon: ${couponData.code}`);
      return couponData;
    } catch (error) {
      console.error('[SupabaseCouponService] Error saving coupon:', error);
      throw error;
    }
  }

  /**
   * Get coupon by code
   */
  async getCoupon(code) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.formatCoupon(data);
    } catch (error) {
      console.error('[SupabaseCouponService] Error getting coupon:', error);
      return null;
    }
  }

  /**
   * Get all active coupons
   */
  async getActiveCoupons() {
    try {
      await this.initialize();

      const now = new Date().toISOString();

      const { data, error } = await this.client
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(c => this.formatCoupon(c));
    } catch (error) {
      console.error('[SupabaseCouponService] Error getting active coupons:', error);
      return [];
    }
  }

  /**
   * Validate and use coupon
   */
  async validateAndUseCoupon(code, userId, subscriptionId = null) {
    try {
      await this.initialize();

      const coupon = await this.getCoupon(code);

      if (!coupon) {
        return { valid: false, message: 'Coupon not found' };
      }

      if (!coupon.isActive) {
        return { valid: false, message: 'Coupon is not active' };
      }

      const now = new Date();
      if (coupon.validUntil && new Date(coupon.validUntil) < now) {
        return { valid: false, message: 'Coupon has expired' };
      }

      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, message: 'Coupon usage limit reached' };
      }

      // Check if single-use coupon already used by this user
      if (coupon.singleUse) {
        const { data: usage } = await this.client
          .from('coupon_usage')
          .select('id')
          .eq('coupon_code', code.toUpperCase())
          .eq('user_id', userId)
          .single();

        if (usage) {
          return { valid: false, message: 'You have already used this coupon' };
        }
      }

      // Record usage
      await this.client.from('coupon_usage').insert({
        coupon_code: code.toUpperCase(),
        user_id: userId,
        subscription_id: subscriptionId
      });

      // Increment used count
      await this.client
        .from('coupons')
        .update({ used_count: coupon.usedCount + 1 })
        .eq('code', code.toUpperCase());

      return {
        valid: true,
        coupon: coupon,
        message: 'Coupon applied successfully'
      };
    } catch (error) {
      console.error('[SupabaseCouponService] Error validating coupon:', error);
      return { valid: false, message: 'Error validating coupon' };
    }
  }

  /**
   * Delete coupon
   */
  async deleteCoupon(code) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('coupons')
        .delete()
        .eq('code', code.toUpperCase());

      if (error) throw error;

      console.log(`[SupabaseCouponService] ✅ Deleted coupon: ${code}`);
      return true;
    } catch (error) {
      console.error('[SupabaseCouponService] Error deleting coupon:', error);
      return false;
    }
  }

  /**
   * Format coupon from database
   */
  formatCoupon(coupon) {
    if (!coupon) return null;

    return {
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      maxUses: coupon.max_uses,
      usedCount: coupon.used_count,
      validFrom: coupon.valid_from,
      validUntil: coupon.valid_until,
      applicablePlans: coupon.applicable_plans,
      isActive: coupon.is_active,
      singleUse: coupon.single_use,
      createdBy: coupon.created_by,
      createdAt: coupon.created_at,
      updatedAt: coupon.updated_at
    };
  }
}

// Create singleton instance
const supabaseCouponService = new SupabaseCouponService();

export default supabaseCouponService;





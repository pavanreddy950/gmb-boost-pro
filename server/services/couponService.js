import supabaseConfig from '../config/supabase.js';

/**
 * Supabase Coupon Service
 * Stores coupons in PostgreSQL instead of JSON files
 * Matches the database schema from server/database/schema.sql
 */
class CouponService {
  constructor() {
    // Singleton pattern - return existing instance if it exists
    if (CouponService.instance) {
      return CouponService.instance;
    }

    this.client = null;
    this.initialized = false;

    // Store the instance
    CouponService.instance = this;
  }

  async initialize() {
    if (this.initialized && this.client) {
      return this.client;
    }

    try {
      this.client = await supabaseConfig.ensureInitialized();
      this.initialized = true;
      console.log('[CouponService] ✅ Initialized with Supabase');

      // Ensure coupons table exists
      await this.ensureCouponsTable();

      // Ensure default test coupon exists
      await this.ensureDefaultCoupon();

      return this.client;
    } catch (error) {
      console.error('[CouponService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Ensure the coupons table exists in Supabase
   */
  async ensureCouponsTable() {
    try {
      console.log('[CouponService] 🔍 Checking if coupons table exists...');

      // Try to select from coupons table to check if it exists
      const { error: checkError } = await this.client
        .from('coupons')
        .select('code')
        .limit(1);

      if (checkError && checkError.code === '42P01') {
        // Table doesn't exist - create it
        console.log('[CouponService] 📝 Creating coupons table...');

        // Use raw SQL to create the table via RPC or direct query
        const { error: createError } = await this.client.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS coupons (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              code TEXT UNIQUE NOT NULL,
              discount_type TEXT NOT NULL DEFAULT 'percentage',
              discount_value DECIMAL(10, 2) NOT NULL,
              max_uses INTEGER,
              used_count INTEGER DEFAULT 0,
              valid_from TIMESTAMP WITH TIME ZONE,
              valid_until TIMESTAMP WITH TIME ZONE,
              applicable_plans TEXT[],
              is_active BOOLEAN DEFAULT true,
              single_use BOOLEAN DEFAULT false,
              created_by TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
            CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
          `
        });

        if (createError) {
          console.log('[CouponService] ⚠️ Could not create table via RPC, table may need manual creation');
          console.log('[CouponService] 📋 Please run this SQL in Supabase:');
          console.log(`
            CREATE TABLE IF NOT EXISTS coupons (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              code TEXT UNIQUE NOT NULL,
              discount_type TEXT NOT NULL DEFAULT 'percentage',
              discount_value DECIMAL(10, 2) NOT NULL,
              max_uses INTEGER,
              used_count INTEGER DEFAULT 0,
              valid_from TIMESTAMP WITH TIME ZONE,
              valid_until TIMESTAMP WITH TIME ZONE,
              applicable_plans TEXT[],
              is_active BOOLEAN DEFAULT true,
              single_use BOOLEAN DEFAULT false,
              created_by TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `);
        } else {
          console.log('[CouponService] ✅ Coupons table created successfully');
        }
      } else if (checkError) {
        console.log('[CouponService] ⚠️ Error checking coupons table:', checkError.message);
      } else {
        console.log('[CouponService] ✅ Coupons table already exists');
      }
    } catch (error) {
      console.error('[CouponService] ❌ Error ensuring coupons table:', error.message || error);
    }
  }

  async ensureDefaultCoupon() {
    try {
      console.log('[CouponService] 🔍 Checking if RAJATEST coupon exists...');

      // Check if RAJATEST coupon exists - use maybeSingle() to avoid error when not found
      const { data: existing, error: selectError } = await this.client
        .from('coupons')
        .select('*')
        .eq('code', 'RAJATEST')
        .maybeSingle();

      // Log the result
      if (selectError) {
        console.log('[CouponService] ⚠️ Error checking coupon (table may not exist):', selectError.message);
      }

      if (existing) {
        console.log('[CouponService] ✅ RAJATEST coupon already exists:', existing.code);
        return;
      }

      // Create default test coupon using upsert to avoid duplicates
      console.log('[CouponService] 📝 Creating RAJATEST coupon...');
      const { data: created, error: insertError } = await this.client
        .from('coupons')
        .upsert({
          code: 'RAJATEST',
          discount_type: 'percentage',
          discount_value: 100,
          max_uses: 10000,
          used_count: 0,
          is_active: true,
          valid_until: '2030-12-31T23:59:59Z',
          single_use: false,
          created_by: 'system'
        }, { onConflict: 'code' })
        .select()
        .single();

      if (insertError) {
        console.error('[CouponService] ❌ Failed to create RAJATEST coupon:', insertError.message);
        throw insertError;
      }

      console.log('[CouponService] ✅ Created default RAJATEST coupon successfully');
    } catch (error) {
      console.error('[CouponService] ❌ Error ensuring default coupon:', error.message || error);
      // Don't throw - allow server to continue even if coupon creation fails
    }
  }

  /**
   * Validate coupon (doesn't increment usage)
   */
  async validateCoupon(code, userId = null) {
    try {
      await this.initialize();

      const upperCode = code.toUpperCase();

      // Get coupon from database
      const { data: coupon, error } = await this.client
        .from('coupons')
        .select('*')
        .eq('code', upperCode)
        .single();

      if (error || !coupon) {
        return {
          valid: false,
          error: 'Coupon code not found'
        };
      }

      // Check if coupon is active
      if (!coupon.is_active) {
        return {
          valid: false,
          error: 'This coupon is no longer active'
        };
      }

      // Check expiration
      if (coupon.valid_until) {
        const expiryDate = new Date(coupon.valid_until);
        if (expiryDate < new Date()) {
          return {
            valid: false,
            error: 'This coupon has expired'
          };
        }
      }

      // Check usage limit
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
        return {
          valid: false,
          error: 'This coupon has reached its usage limit'
        };
      }

      // Check single use (check coupon_usage table)
      if (coupon.single_use && userId) {
        const { data: usage } = await this.client
          .from('coupon_usage')
          .select('*')
          .eq('coupon_code', upperCode)
          .eq('user_id', userId)
          .single();

        if (usage) {
          return {
            valid: false,
            error: 'You have already used this coupon'
          };
        }
      }

      return {
        valid: true,
        coupon: {
          code: coupon.code,
          type: coupon.discount_type,
          discount: coupon.discount_value,
          description: `Save ${coupon.discount_type === 'percentage' ? coupon.discount_value + '%' : '₹' + coupon.discount_value}`
        }
      };
    } catch (error) {
      console.error('[CouponService] Error validating coupon:', error);
      return {
        valid: false,
        error: 'Error validating coupon'
      };
    }
  }

  /**
   * Apply coupon (validates and increments usage)
   */
  async applyCoupon(code, amount, userId = null) {
    try {
      await this.initialize();

      const upperCode = code.toUpperCase();

      // First validate the coupon
      const validation = await this.validateCoupon(upperCode, userId);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const coupon = validation.coupon;
      let discountAmount = 0;
      let finalAmount = amount;

      // Calculate discount
      if (coupon.type === 'percentage') {
        discountAmount = Math.round(amount * (coupon.discount / 100));
        finalAmount = amount - discountAmount;
      } else if (coupon.type === 'fixed') {
        discountAmount = Math.min(coupon.discount, amount);
        finalAmount = Math.max(0, amount - discountAmount);
      }

      // Special handling for RAJATEST - set final amount to exactly ₹1
      if (upperCode === 'RAJATEST') {
        finalAmount = 1;
        discountAmount = amount - 1;
      }

      // Increment coupon usage in database
      // First get the current count
      const { data: currentCoupon } = await this.client
        .from('coupons')
        .select('used_count')
        .eq('code', upperCode)
        .single();

      if (currentCoupon) {
        const { error: updateError } = await this.client
          .from('coupons')
          .update({ used_count: (currentCoupon.used_count || 0) + 1 })
          .eq('code', upperCode);

        if (updateError) {
          console.error('[CouponService] Error incrementing usage:', updateError);
        }
      }

      // Record usage if userId is provided
      if (userId) {
        const { error: usageError } = await this.client
          .from('coupon_usage')
          .insert({
            coupon_code: upperCode,
            user_id: userId
          });

        if (usageError && !usageError.message?.includes('duplicate')) {
          console.error('[CouponService] Error recording usage:', usageError);
        }
      }

      console.log(`[CouponService] Applied coupon ${upperCode}: ${amount} → ${finalAmount} (discount: ${discountAmount})`);

      return {
        success: true,
        originalAmount: amount,
        discountAmount,
        finalAmount,
        discountPercentage: Math.round((discountAmount / amount) * 100),
        couponCode: upperCode
      };
    } catch (error) {
      console.error('[CouponService] Error applying coupon:', error);
      return {
        success: false,
        error: 'Error applying coupon'
      };
    }
  }

  /**
   * Get all coupons (admin view)
   */
  async getAllCoupons() {
    try {
      await this.initialize();

      const { data: coupons, error } = await this.client
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to frontend format
      return coupons.map(c => ({
        code: c.code,
        discountType: c.discount_type,
        discountValue: c.discount_value,
        maxUses: c.max_uses,
        currentUses: c.used_count || 0,
        isActive: c.is_active,
        expiresAt: c.valid_until,
        singleUse: c.single_use,
        createdAt: c.created_at,
        description: `${c.discount_type === 'percentage' ? c.discount_value + '% off' : '₹' + c.discount_value + ' off'}`
      }));
    } catch (error) {
      console.error('[CouponService] Error getting all coupons:', error);
      return [];
    }
  }

  /**
   * Create a new coupon
   */
  async createCoupon(couponData) {
    try {
      await this.initialize();

      const code = couponData.code.toUpperCase();

      // Check if coupon already exists
      const { data: existing } = await this.client
        .from('coupons')
        .select('code')
        .eq('code', code)
        .single();

      if (existing) {
        return {
          success: false,
          error: 'A coupon with this code already exists'
        };
      }

      // Insert new coupon
      const { data: coupon, error } = await this.client
        .from('coupons')
        .insert({
          code,
          discount_value: couponData.discount,
          discount_type: couponData.type || 'percentage',
          is_active: true,
          max_uses: couponData.maxUses || 100,
          used_count: 0,
          valid_until: couponData.validUntil ? new Date(couponData.validUntil).toISOString() : '2030-12-31T23:59:59Z',
          single_use: couponData.singleUse || false,
          created_by: 'admin'
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[CouponService] ✅ Created coupon: ${code}`);

      return {
        success: true,
        coupon: {
          code: coupon.code,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          maxUses: coupon.max_uses,
          currentUses: coupon.used_count,
          isActive: coupon.is_active,
          expiresAt: coupon.valid_until,
          singleUse: coupon.single_use
        }
      };
    } catch (error) {
      console.error('[CouponService] Error creating coupon:', error);
      return {
        success: false,
        error: error.message || 'Failed to create coupon'
      };
    }
  }

  /**
   * Deactivate a coupon
   */
  async deactivateCoupon(code) {
    try {
      await this.initialize();

      const upperCode = code.toUpperCase();

      const { data, error } = await this.client
        .from('coupons')
        .update({ is_active: false })
        .eq('code', upperCode)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return {
          success: false,
          error: 'Coupon not found'
        };
      }

      console.log(`[CouponService] ✅ Deactivated coupon: ${upperCode}`);

      return {
        success: true,
        message: 'Coupon deactivated successfully'
      };
    } catch (error) {
      console.error('[CouponService] Error deactivating coupon:', error);
      return {
        success: false,
        error: error.message || 'Failed to deactivate coupon'
      };
    }
  }
}

// Export singleton instance
const couponService = new CouponService();
export default couponService;

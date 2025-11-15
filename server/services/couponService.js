import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CouponService {
  constructor() {
    // Singleton pattern - return existing instance if it exists
    if (CouponService.instance) {
      return CouponService.instance;
    }

    this.couponsFile = path.join(__dirname, '../data/coupons.json');
    this.coupons = new Map();
    this.loadCoupons();

    // Store the instance
    CouponService.instance = this;
  }

  loadCoupons() {
    try {
      if (fs.existsSync(this.couponsFile)) {
        const data = fs.readFileSync(this.couponsFile, 'utf8');
        const couponsObj = JSON.parse(data);
        
        // Convert validUntil and expiresAt strings back to Date objects
        Object.entries(couponsObj).forEach(([code, coupon]) => {
          if (coupon.validUntil) {
            coupon.validUntil = new Date(coupon.validUntil);
          }
          if (coupon.expiresAt) {
            coupon.expiresAt = new Date(coupon.expiresAt);
          }
          this.coupons.set(code, coupon);
        });
        
        console.log(`[CouponService] Loaded ${this.coupons.size} coupons from file`);
      } else {
        console.log('[CouponService] No coupons file found, initializing with default coupon');
        // Initialize with default test coupon
        const defaultCoupon = {
          code: 'RAJATEST',
          discount: 100,
          type: 'percentage',
          active: true,
          isActive: true,
          maxUses: 10000,
          usedCount: 0,
          currentUses: 0,
          description: 'Internal testing - Pay only ₹1',
          validUntil: new Date('2030-12-31'),
          expiresAt: new Date('2030-12-31'),
          hidden: true,
          oneTimePerUser: false,
          usedBy: [],
          createdAt: new Date().toISOString()
        };
        this.coupons.set('RAJATEST', defaultCoupon);
        this.saveCoupons();
      }
    } catch (error) {
      console.error('[CouponService] Error loading coupons:', error);
      // Initialize with empty map on error
      this.coupons = new Map();
    }
  }

  saveCoupons() {
    try {
      const couponsObj = {};
      this.coupons.forEach((coupon, code) => {
        couponsObj[code] = {
          ...coupon,
          validUntil: coupon.validUntil ? coupon.validUntil.toISOString() : null,
          expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null
        };
      });
      
      fs.writeFileSync(this.couponsFile, JSON.stringify(couponsObj, null, 2), 'utf8');
      console.log(`[CouponService] Saved ${this.coupons.size} coupons to file`);
    } catch (error) {
      console.error('[CouponService] Error saving coupons:', error);
    }
  }

  validateCoupon(code, userId = null) {
    // Reload coupons from file to get latest data
    this.loadCoupons();

    const upperCode = code.toUpperCase();
    console.log(`[CouponService] Validating coupon: "${upperCode}" (original: "${code}")`);
    console.log(`[CouponService] Available coupons:`, Array.from(this.coupons.keys()));

    const coupon = this.coupons.get(upperCode);

    if (!coupon) {
      console.log(`[CouponService] ❌ Coupon "${upperCode}" not found`);
      return {
        valid: false,
        error: 'Invalid coupon code'
      };
    }

    console.log(`[CouponService] Found coupon:`, {
      code: coupon.code,
      active: coupon.active,
      usedCount: coupon.usedCount,
      maxUses: coupon.maxUses,
      validUntil: coupon.validUntil,
      validUntilType: typeof coupon.validUntil
    });

    if (!coupon.active) {
      console.log(`[CouponService] ❌ Coupon "${upperCode}" is not active`);
      return {
        valid: false,
        error: 'This coupon is no longer active'
      };
    }

    if (coupon.usedCount >= coupon.maxUses) {
      console.log(`[CouponService] ❌ Coupon "${upperCode}" has reached usage limit`);
      return {
        valid: false,
        error: 'This coupon has reached its usage limit'
      };
    }

    if (new Date() > coupon.validUntil) {
      console.log(`[CouponService] ❌ Coupon "${upperCode}" has expired. Valid until: ${coupon.validUntil}, Now: ${new Date()}`);
      return {
        valid: false,
        error: 'This coupon has expired'
      };
    }

    // Check if this coupon is one-time per user and user has already used it
    if (coupon.oneTimePerUser && userId && coupon.usedBy && coupon.usedBy.includes(userId)) {
      console.log(`[CouponService] ❌ User ${userId} has already used coupon "${upperCode}"`);
      return {
        valid: false,
        error: 'You have already used this coupon'
      };
    }

    console.log(`[CouponService] ✅ Coupon "${upperCode}" is valid`);
    return {
      valid: true,
      coupon
    };
  }

  applyCoupon(code, originalAmount, userId = null) {
    const validation = this.validateCoupon(code, userId);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        originalAmount,
        finalAmount: originalAmount
      };
    }

    const coupon = validation.coupon;
    let discountAmount = 0;
    let finalAmount = originalAmount;

    if (coupon.type === 'percentage') {
      discountAmount = Math.round(originalAmount * (coupon.discount / 100));
      finalAmount = originalAmount - discountAmount;
    } else if (coupon.type === 'fixed') {
      discountAmount = Math.min(coupon.discount, originalAmount);
      finalAmount = Math.max(0, originalAmount - discountAmount);
    }

    // For RAJATEST coupon, ensure final amount is exactly Rs. 1 (Razorpay minimum)
    if (coupon.code === 'RAJATEST') {
      finalAmount = 1; // Rs. 1 for testing
    }

    // Increment usage count
    coupon.usedCount++;
    coupon.currentUses = coupon.usedCount; // Update currentUses for frontend

    // Track user if one-time per user and userId is provided
    if (coupon.oneTimePerUser && userId) {
      if (!coupon.usedBy) {
        coupon.usedBy = [];
      }
      if (!coupon.usedBy.includes(userId)) {
        coupon.usedBy.push(userId);
      }
    }

    // Auto-disable if singleUse flag is set
    if (coupon.singleUse && coupon.usedCount >= 1) {
      coupon.active = false;
      coupon.isActive = false;
      console.log(`[CouponService] 🔒 Auto-disabled single-use coupon: ${coupon.code}`);
    }

    // Persist the updated coupon usage
    this.saveCoupons();

    console.log(`[CouponService] Applied coupon ${coupon.code}: ${originalAmount} → ${finalAmount} (discount: ${discountAmount})`);
    return {
      success: true,
      couponCode: coupon.code,
      originalAmount,
      discountAmount,
      finalAmount,
      discountPercentage: Math.round((discountAmount / originalAmount) * 100),
      description: coupon.description
    };
  }

  getAllCoupons() {
    // Only return non-hidden coupons
    return Array.from(this.coupons.values()).filter(coupon => !coupon.hidden);
  }

  createCoupon(couponData) {
    const code = couponData.code.toUpperCase();
    
    if (this.coupons.has(code)) {
      return {
        success: false,
        error: 'Coupon code already exists'
      };
    }

    const coupon = {
      code,
      discount: couponData.discount,
      type: couponData.type || 'percentage',
      active: true,
      isActive: true, // Add isActive for frontend compatibility
      maxUses: couponData.maxUses || 100,
      usedCount: 0,
      currentUses: 0, // Add currentUses for frontend compatibility
      description: couponData.description || '',
      validUntil: couponData.validUntil || new Date('2025-12-31'),
      expiresAt: couponData.validUntil || new Date('2025-12-31'), // Add expiresAt for frontend compatibility
      oneTimePerUser: couponData.oneTimePerUser || false,
      singleUse: couponData.singleUse || false, // Auto-disable after first use
      usedBy: [], // Track which users have used this coupon
      createdAt: new Date().toISOString()
    };

    this.coupons.set(code, coupon);
    this.saveCoupons(); // Persist to file

    console.log(`[CouponService] Created coupon: ${code}`);
    return {
      success: true,
      coupon
    };
  }

  deactivateCoupon(code) {
    const coupon = this.coupons.get(code.toUpperCase());
    
    if (!coupon) {
      return {
        success: false,
        error: 'Coupon not found'
      };
    }

    coupon.active = false;
    coupon.isActive = false; // Update isActive for frontend compatibility
    this.saveCoupons(); // Persist to file
    
    console.log(`[CouponService] Deactivated coupon: ${code}`);
    return {
      success: true,
      message: 'Coupon deactivated successfully'
    };
  }
}

export default CouponService;
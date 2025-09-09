class CouponService {
  constructor() {
    // Hidden test coupon - NOT visible to users
    this.coupons = new Map([
      ['RAJATEST', {
        code: 'RAJATEST',
        discount: 100, // 100% discount for internal testing
        type: 'percentage',
        active: true,
        maxUses: 10000,
        usedCount: 0,
        description: 'Internal testing - Pay only ₹1',
        validUntil: new Date('2030-12-31'),
        hidden: true // This flag indicates it should not be shown to users
      }]
    ]);
  }

  validateCoupon(code) {
    const coupon = this.coupons.get(code.toUpperCase());
    
    if (!coupon) {
      return {
        valid: false,
        error: 'Invalid coupon code'
      };
    }

    if (!coupon.active) {
      return {
        valid: false,
        error: 'This coupon is no longer active'
      };
    }

    if (coupon.usedCount >= coupon.maxUses) {
      return {
        valid: false,
        error: 'This coupon has reached its usage limit'
      };
    }

    if (new Date() > coupon.validUntil) {
      return {
        valid: false,
        error: 'This coupon has expired'
      };
    }

    return {
      valid: true,
      coupon
    };
  }

  applyCoupon(code, originalAmount) {
    const validation = this.validateCoupon(code);
    
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
      maxUses: couponData.maxUses || 100,
      usedCount: 0,
      description: couponData.description || '',
      validUntil: couponData.validUntil || new Date('2025-12-31')
    };

    this.coupons.set(code, coupon);

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
    
    return {
      success: true,
      message: 'Coupon deactivated successfully'
    };
  }
}

export default CouponService;
/**
 * User Payment Routes - Simplified payment system using gmail_id
 *
 * This router handles:
 * - Subscription status checks (by email)
 * - Trial creation (by email)
 * - Payment verification (updates users table by email)
 *
 * PRIMARY KEY: gmail_id (user's email address)
 */

import express from 'express';
import PaymentService from '../services/paymentService.js';
import userService from '../services/userService.js';
import couponService from '../services/couponService.js';

const router = express.Router();
const paymentService = new PaymentService();

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

/**
 * Check subscription status by email
 * GET /api/user-payment/status?email=user@example.com
 */
router.get('/status', async (req, res) => {
  try {
    const { email, userId } = req.query;

    console.log('[UserPayment] Status check - email:', email, 'userId:', userId);

    if (!email && !userId) {
      return res.status(400).json({ error: 'Email or userId is required' });
    }

    let userEmail = email;

    // If only userId provided, try to find user by firebase_uid
    if (!userEmail && userId) {
      const user = await userService.getUserByFirebaseUid(userId);
      if (user) {
        userEmail = user.gmail_id;
      } else {
        return res.json({
          status: 'none',
          isValid: false,
          canUsePlatform: true,
          message: 'No user found'
        });
      }
    }

    const status = await userService.checkSubscriptionStatus(userEmail);
    console.log('[UserPayment] Status result for', userEmail, ':', JSON.stringify(status));

    // IMPORTANT: Ensure we always return proper status - never accidentally reset subscription
    if (status.status === 'none') {
      console.log('[UserPayment] ⚠️ Warning: Returning status=none for', userEmail, '- message:', status.message);
    }

    res.json(status);
  } catch (error) {
    console.error('[UserPayment] Status error:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// ============================================================================
// TRIAL SUBSCRIPTION
// ============================================================================

/**
 * Create trial subscription for new user
 * POST /api/user-payment/trial
 * Body: { email, userId, displayName }
 */
router.post('/trial', async (req, res) => {
  try {
    const { email, userId, displayName } = req.body;

    console.log('[UserPayment] Creating trial - email:', email, 'userId:', userId);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await userService.createTrialSubscription(email, userId, displayName);

    res.json({
      success: true,
      subscription: {
        id: user.gmail_id,
        status: user.subscription_status,
        trialEndDate: user.trial_end_date,
        profileCount: user.profile_count,
        email: user.gmail_id
      }
    });
  } catch (error) {
    console.error('[UserPayment] Trial error:', error);
    res.status(500).json({ error: 'Failed to create trial subscription' });
  }
});

// ============================================================================
// PAYMENT VERIFICATION
// ============================================================================

/**
 * Verify payment and activate subscription
 * POST /api/user-payment/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, profileCount }
 */
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      profileCount
    } = req.body;

    console.log('[UserPayment] ========================================');
    console.log('[UserPayment] Payment verification request');
    console.log('[UserPayment] Email:', email);
    console.log('[UserPayment] Profile count:', profileCount);
    console.log('[UserPayment] Order ID:', razorpay_order_id);
    console.log('[UserPayment] Payment ID:', razorpay_payment_id);
    console.log('[UserPayment] ========================================');

    if (!email) {
      console.error('[UserPayment] ❌ Email is required');
      return res.status(400).json({ error: 'Email is required for payment verification' });
    }

    // Verify payment signature
    const isValid = paymentService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      console.error('[UserPayment] ❌ Invalid payment signature');
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    console.log('[UserPayment] ✅ Payment signature verified');

    // Get payment details from Razorpay
    const payment = await paymentService.getPayment(razorpay_payment_id);
    console.log('[UserPayment] Payment details:', {
      id: payment.id,
      amount: payment.amount,
      status: payment.status
    });

    // Get order details to extract profileCount from notes
    const order = await paymentService.getOrder(razorpay_order_id);
    const orderProfileCount = order.notes?.profileCount || order.notes?.actualProfileCount || profileCount || 1;

    console.log('[UserPayment] Profile count from order notes:', orderProfileCount);

    // Activate subscription
    const user = await userService.activateSubscription(email, {
      profileCount: parseInt(orderProfileCount),
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: payment.amount / 100 // Convert paise to rupees
    });

    console.log('[UserPayment] ✅ Subscription activated:', {
      email: user.gmail_id,
      status: user.subscription_status,
      profileCount: user.profile_count,
      subscriptionEndDate: user.subscription_end_date
    });

    res.json({
      success: true,
      message: 'Payment verified and subscription activated!',
      subscription: {
        id: user.gmail_id,
        status: user.subscription_status,
        profileCount: user.profile_count,
        subscriptionEndDate: user.subscription_end_date,
        email: user.gmail_id
      }
    });
  } catch (error) {
    console.error('[UserPayment] ❌ Verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

/**
 * Verify subscription payment (Razorpay subscription model)
 * POST /api/user-payment/verify-subscription
 */
router.post('/verify-subscription', async (req, res) => {
  try {
    const {
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      profileCount
    } = req.body;

    console.log('[UserPayment] ========================================');
    console.log('[UserPayment] Subscription payment verification');
    console.log('[UserPayment] Email:', email);
    console.log('[UserPayment] Profile count:', profileCount);
    console.log('[UserPayment] Subscription ID:', razorpay_subscription_id);
    console.log('[UserPayment] ========================================');

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Verify subscription signature
    const isValid = paymentService.verifySubscriptionSignature(
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    console.log('[UserPayment] ✅ Subscription signature verified');

    // Get subscription details
    const subscription = await paymentService.getSubscription(razorpay_subscription_id);
    const subscriptionProfileCount = subscription.notes?.actualProfileCount ||
                                     subscription.notes?.profileCount ||
                                     subscription.quantity ||
                                     profileCount || 1;

    // Get payment details
    const payment = await paymentService.fetchPaymentDetails(razorpay_payment_id);

    // Activate subscription
    const user = await userService.activateSubscription(email, {
      profileCount: parseInt(subscriptionProfileCount),
      razorpaySubscriptionId: razorpay_subscription_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: payment.amount / 100
    });

    console.log('[UserPayment] ✅ Subscription activated:', {
      email: user.gmail_id,
      profileCount: user.profile_count
    });

    res.json({
      success: true,
      message: 'Subscription activated with auto-pay',
      subscription: {
        id: user.gmail_id,
        status: user.subscription_status,
        profileCount: user.profile_count,
        subscriptionEndDate: user.subscription_end_date,
        email: user.gmail_id
      }
    });
  } catch (error) {
    console.error('[UserPayment] ❌ Verification error:', error);
    res.status(500).json({ error: 'Failed to verify subscription payment' });
  }
});

// ============================================================================
// COUPON VALIDATION
// ============================================================================

/**
 * Validate coupon code
 * POST /api/user-payment/coupon/validate
 */
router.post('/coupon/validate', async (req, res) => {
  try {
    const { code, amount, email } = req.body;

    console.log('[UserPayment] Validating coupon:', code, 'for amount:', amount);

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const validation = await couponService.validateCoupon(code, email);

    if (!validation.valid) {
      return res.json({
        success: false,
        error: validation.error,
        originalAmount: amount,
        finalAmount: amount
      });
    }

    const coupon = validation.coupon;
    let discountAmount = 0;
    let finalAmount = amount;

    if (coupon.type === 'percentage') {
      discountAmount = Math.round(amount * (coupon.discount / 100));
      finalAmount = amount - discountAmount;
    } else if (coupon.type === 'fixed') {
      discountAmount = Math.min(coupon.discount, amount);
      finalAmount = Math.max(0, amount - discountAmount);
    }

    // Special handling for RAJATEST - set final amount to exactly Rs. 1
    if (coupon.code === 'RAJATEST') {
      finalAmount = 1;
      discountAmount = amount - 1;
    }

    res.json({
      success: true,
      valid: true,
      couponCode: coupon.code,
      originalAmount: amount,
      discountAmount,
      finalAmount,
      discountPercentage: Math.round((discountAmount / amount) * 100),
      description: coupon.description
    });
  } catch (error) {
    console.error('[UserPayment] Coupon validation error:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// ============================================================================
// ORDER CREATION
// ============================================================================

/**
 * Create Razorpay order
 * POST /api/user-payment/order
 */
router.post('/order', async (req, res) => {
  try {
    const { amount, currency = 'INR', email, profileCount, couponCode, notes = {} } = req.body;

    console.log('[UserPayment] ========================================');
    console.log('[UserPayment] Creating order');
    console.log('[UserPayment] Email:', email);
    console.log('[UserPayment] Amount:', amount);
    console.log('[UserPayment] Profile count:', profileCount);
    console.log('[UserPayment] Coupon:', couponCode);
    console.log('[UserPayment] ========================================');

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!profileCount || profileCount < 1) {
      return res.status(400).json({ error: 'Profile count is required' });
    }

    let finalAmount = amount;
    let couponDetails = null;

    // Apply coupon if provided
    if (couponCode) {
      const couponResult = await couponService.applyCoupon(couponCode, amount, email);
      if (couponResult.success) {
        finalAmount = couponResult.finalAmount;
        couponDetails = couponResult;
        console.log('[UserPayment] Coupon applied:', couponCode, 'Final amount:', finalAmount);
      } else {
        return res.status(400).json({ error: couponResult.error });
      }
    }

    // Create order with email and profileCount in notes
    const orderNotes = {
      ...notes,
      email,
      profileCount: profileCount.toString(),
      actualProfileCount: profileCount.toString(),
      couponCode: couponCode || ''
    };

    const order = await paymentService.createOrder(finalAmount, currency, orderNotes);
    console.log('[UserPayment] Order created:', order.id);

    res.json({
      order,
      couponDetails,
      originalAmount: amount,
      finalAmount,
      currency
    });
  } catch (error) {
    console.error('[UserPayment] Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ============================================================================
// USER DATA
// ============================================================================

/**
 * Get user data by email
 * GET /api/user-payment/user?email=user@example.com
 */
router.get('/user', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await userService.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't return sensitive token data
    res.json({
      email: user.gmail_id,
      displayName: user.display_name,
      subscriptionStatus: user.subscription_status,
      trialStartDate: user.trial_start_date,
      trialEndDate: user.trial_end_date,
      subscriptionStartDate: user.subscription_start_date,
      subscriptionEndDate: user.subscription_end_date,
      profileCount: user.profile_count,
      isAdmin: user.is_admin,
      hasValidToken: user.has_valid_token,
      amountPaid: user.amount_paid
    });
  } catch (error) {
    console.error('[UserPayment] Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

/**
 * Update profile count
 * POST /api/user-payment/update-profile-count
 */
router.post('/update-profile-count', async (req, res) => {
  try {
    const { email, profileCount } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (profileCount === undefined || profileCount < 0) {
      return res.status(400).json({ error: 'Valid profile count is required' });
    }

    const user = await userService.updateUser(email, { profile_count: profileCount });

    res.json({
      success: true,
      profileCount: user.profile_count,
      message: 'Profile count updated successfully'
    });
  } catch (error) {
    console.error('[UserPayment] Update profile count error:', error);
    res.status(500).json({ error: 'Failed to update profile count' });
  }
});

export default router;

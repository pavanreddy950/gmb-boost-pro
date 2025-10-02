import express from 'express';
import PaymentService from '../services/paymentService.js';
import SubscriptionService from '../services/subscriptionService.js';
import CouponService from '../services/couponService.js';
import CurrencyService from '../services/currencyService.js';
import GeolocationService from '../utils/geolocation.js';

const router = express.Router();
const paymentService = new PaymentService();
const subscriptionService = new SubscriptionService();
const couponService = new CouponService();
const currencyService = new CurrencyService();
const geolocationService = new GeolocationService();

// Health check for payment service
router.get('/health', async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    const health = {
      status: 'ok',
      razorpay: {
        configured: !!(keyId && keySecret),
        keyId: keyId ? `${keyId.substring(0, 10)}...` : 'NOT SET',
        keySecret: keySecret ? 'SET' : 'NOT SET'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(health);
  } catch (error) {
    console.error('Payment health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test Razorpay connectivity
router.get('/test', async (req, res) => {
  try {
    console.log('[Payment Test] Testing Razorpay connectivity...');
    
    // Try to create a minimal test order
    const testOrder = await paymentService.createOrder(1, 'INR', { test: true });
    
    res.json({
      status: 'success',
      message: 'Razorpay is working correctly',
      testOrder: {
        id: testOrder.id,
        amount: testOrder.amount,
        currency: testOrder.currency,
        status: testOrder.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Payment Test] Razorpay test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Razorpay test failed',
      error: error.message,
      details: {
        code: error.code,
        statusCode: error.statusCode,
        response: error.response?.data
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Detect user's currency based on location
router.get('/detect-currency', async (req, res) => {
  try {
    const clientIP = geolocationService.getClientIP(req);
    console.log('[Currency Detection] Client IP:', clientIP);

    const location = await geolocationService.getLocationByIP(clientIP);
    const rates = await currencyService.getExchangeRates();

    res.json({
      detectedCurrency: location.currency,
      countryCode: location.countryCode,
      country: location.country,
      exchangeRate: rates[location.currency],
      currencySymbol: currencyService.getCurrencySymbol(location.currency),
      isSupported: currencyService.isCurrencySupported(location.currency),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Currency Detection] Error:', error);
    res.status(500).json({ error: 'Failed to detect currency' });
  }
});

// Get live exchange rates
router.get('/exchange-rates', async (req, res) => {
  try {
    console.log('[Currency] Fetching exchange rates...');
    const rates = await currencyService.getExchangeRates();
    const supportedCurrencies = currencyService.getRazorpaySupportedCurrencies();

    res.json({
      baseCurrency: 'USD',
      rates,
      supportedCurrencies,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Currency] Error fetching exchange rates:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

// Convert currency
router.post('/convert-currency', async (req, res) => {
  try {
    const { amount, targetCurrency } = req.body;

    if (!amount || !targetCurrency) {
      return res.status(400).json({ error: 'amount and targetCurrency are required' });
    }

    const conversion = await currencyService.convertFromUSD(amount, targetCurrency);
    res.json(conversion);
  } catch (error) {
    console.error('[Currency] Conversion error:', error);
    res.status(500).json({ error: 'Failed to convert currency' });
  }
});

// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = subscriptionService.getPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Check subscription status
router.get('/subscription/status', async (req, res) => {
  try {
    const { gbpAccountId, userId } = req.query;

    console.log('[Payment Status] Query params:', { gbpAccountId, userId });

    // If neither gbpAccountId nor userId is provided, return error
    if (!gbpAccountId && !userId) {
      return res.status(400).json({ error: 'Either GBP Account ID or User ID is required' });
    }

    let status;

    // Try to get subscription by GBP account ID first (most specific)
    if (gbpAccountId) {
      status = subscriptionService.checkSubscriptionStatus(gbpAccountId);
      console.log('[Payment Status] Status by GBP ID:', status);
    }

    // If no subscription found by GBP ID or no GBP ID provided, try user ID
    if ((!status || status.status === 'none') && userId) {
      const userSubscription = subscriptionService.getSubscriptionByUserId(userId);
      if (userSubscription) {
        // Convert subscription to status format
        status = subscriptionService.checkSubscriptionStatusBySubscription(userSubscription);
        console.log('[Payment Status] Status by User ID:', status);

        // Add message to reconnect GBP if found by user ID but no GBP connected
        if (!gbpAccountId && status.status !== 'none') {
          status.message = 'Subscription found! Please reconnect your Google Business Profile to access all features.';
        }
      } else {
        // No subscription found by user ID either
        status = {
          isValid: false,
          status: 'none',
          subscription: null,
          canUsePlatform: true,
          requiresPayment: false,
          billingOnly: false
        };
      }
    }

    res.json(status);
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// Create trial subscription
router.post('/subscription/trial', async (req, res) => {
  try {
    const { userId, gbpAccountId, email } = req.body;
    
    console.log('[Payment Route] Creating trial - userId:', userId, 'gbpAccountId:', gbpAccountId, 'email:', email);
    
    if (!userId || !gbpAccountId || !email) {
      return res.status(400).json({ error: 'userId, gbpAccountId, and email are required' });
    }
    
    const subscription = await subscriptionService.createTrialSubscription(userId, gbpAccountId, email);
    console.log('[Payment Route] Trial created successfully:', subscription);
    res.json({ subscription });
  } catch (error) {
    console.error('Error creating trial subscription:', error);
    res.status(500).json({ error: 'Failed to create trial subscription' });
  }
});

// Validate coupon
router.post('/coupon/validate', async (req, res) => {
  try {
    const { code, amount, userId } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }
    
    // Pass userId to check one-time per user coupons
    const result = couponService.applyCoupon(code, amount, userId);
    res.json(result);
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// Get available coupons (excludes hidden test coupons)
router.get('/coupons', async (req, res) => {
  try {
    // This will only return public coupons, not hidden ones like RAJATEST
    const publicCoupons = couponService.getAllCoupons();
    res.json({ coupons: publicCoupons });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// Create Razorpay order with dynamic currency conversion
router.post('/order', async (req, res) => {
  try {
    console.log('[Payment Route] Creating order with body:', req.body);

    const {
      amount,
      currency = 'INR',
      notes = {},
      couponCode,
      usdAmount // Original USD amount before conversion
    } = req.body;

    if (!amount) {
      console.log('[Payment Route] Error: Amount is required');
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Verify currency is supported by Razorpay
    if (!currencyService.isCurrencySupported(currency)) {
      return res.status(400).json({
        error: `Currency ${currency} is not supported. Supported currencies: ${currencyService.getRazorpaySupportedCurrencies().join(', ')}`
      });
    }

    console.log('[Payment Route] Processing order - Amount:', amount, 'Currency:', currency, 'USD Amount:', usdAmount, 'Coupon:', couponCode);

    let finalAmount = amount;
    let couponDetails = null;
    let conversionDetails = null;

    // If USD amount is provided, get live conversion rate and add to notes
    if (usdAmount && currency !== 'USD') {
      try {
        const conversion = await currencyService.convertFromUSD(usdAmount, currency);
        conversionDetails = conversion;

        // Use the live converted amount
        finalAmount = Math.round(conversion.convertedAmount);

        console.log(`[Payment Route] 💱 Live conversion: $${usdAmount} USD → ${finalAmount} ${currency} (rate: ${conversion.exchangeRate})`);

        // Add conversion details to notes
        notes.originalUsdAmount = usdAmount;
        notes.exchangeRate = conversion.exchangeRate;
        notes.conversionTimestamp = conversion.timestamp;
      } catch (conversionError) {
        console.error('[Payment Route] Currency conversion failed:', conversionError.message);
        // Continue with the provided amount if conversion fails
      }
    }

    // Apply coupon if provided
    if (couponCode) {
      console.log('[Payment Route] Applying coupon:', couponCode);
      // Get userId from notes if available for one-time per user validation
      const userId = notes.userId || notes.firebaseUid || null;
      const couponResult = couponService.applyCoupon(couponCode, finalAmount, userId);
      if (couponResult.success) {
        const beforeCoupon = finalAmount;
        finalAmount = couponResult.finalAmount;
        couponDetails = couponResult;
        notes.couponCode = couponCode;
        notes.amountBeforeCoupon = beforeCoupon;
        notes.discountAmount = couponResult.discountAmount;
        console.log(`[Payment Route] Coupon ${couponCode} applied: ${currencyService.formatAmount(beforeCoupon, currency)} → ${currencyService.formatAmount(finalAmount, currency)}`);
      } else {
        console.log('[Payment Route] Coupon application failed:', couponResult.error);
        return res.status(400).json({ error: couponResult.error });
      }
    }

    console.log('[Payment Route] Creating Razorpay order with amount:', finalAmount, currency);
    const order = await paymentService.createOrder(finalAmount, currency, notes);
    console.log('[Payment Route] Order created successfully:', order.id);

    res.json({
      order,
      couponDetails,
      conversionDetails,
      originalAmount: amount,
      finalAmount,
      currency,
      formatted: currencyService.formatAmount(finalAmount, currency)
    });
  } catch (error) {
    console.error('[Payment Route] Error creating order:', error);
    console.error('[Payment Route] Error stack:', error.stack);
    console.error('[Payment Route] Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      response: error.response?.data
    });
    
    res.status(500).json({ 
      error: 'Failed to create order',
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Create subscription
router.post('/subscription/create', async (req, res) => {
  try {
    const { planId, gbpAccountId, customerDetails } = req.body;
    
    if (!planId || !gbpAccountId || !customerDetails) {
      return res.status(400).json({ error: 'planId, gbpAccountId, and customerDetails are required' });
    }
    
    // Get existing subscription
    const existingSubscription = subscriptionService.getSubscriptionByGBPAccount(gbpAccountId);
    if (!existingSubscription) {
      return res.status(404).json({ error: 'No trial subscription found for this GBP account' });
    }
    
    // Create Razorpay customer
    const customer = await paymentService.createCustomer(
      customerDetails.email,
      customerDetails.name,
      customerDetails.contact
    );
    
    // Get plan details
    const plan = subscriptionService.getPlan(planId);
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }
    
    // Create Razorpay plan if not exists
    const razorpayPlan = await paymentService.createPlan(
      plan.name,
      plan.amount,
      plan.currency,
      plan.interval
    );
    
    // Create Razorpay subscription
    const razorpaySubscription = await paymentService.createSubscription(
      razorpayPlan.id,
      customer.id,
      { gbpAccountId }
    );
    
    // Update local subscription
    const updatedSubscription = await subscriptionService.activateSubscription(
      existingSubscription.id,
      planId,
      razorpaySubscription.id,
      customer.id
    );
    
    res.json({ 
      subscription: updatedSubscription,
      razorpaySubscription,
      customer
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Verify payment
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscriptionId, gbpAccountId, planId } = req.body;
    
    console.log('[Payment Verify] Received:', { razorpay_order_id, razorpay_payment_id, subscriptionId, gbpAccountId, planId });
    
    const isValid = paymentService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
    
    // Get payment details
    const payment = await paymentService.getPayment(razorpay_payment_id);
    console.log('[Payment Verify] Payment details:', payment);

    // Get order details to extract profileCount from notes
    const order = await paymentService.getOrder(razorpay_order_id);
    console.log('[Payment Verify] Order details:', order);

    // Extract profileCount from order notes (if available)
    const profileCount = order.notes?.profileCount ? parseInt(order.notes.profileCount) : 1;
    console.log('[Payment Verify] Profile count from order notes:', profileCount);

    // Find subscription by GBP Account ID
    let subscription = null;
    if (gbpAccountId) {
      subscription = subscriptionService.getSubscriptionByGBPAccount(gbpAccountId);
    } else if (subscriptionId) {
      subscription = subscriptionService.getSubscriptionById(subscriptionId);
    }

    if (subscription) {
      // Add payment record
      subscriptionService.addPaymentRecord(subscription.id, {
        amount: payment.amount / 100,
        currency: payment.currency,
        status: 'success',
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        description: payment.description || 'Subscription payment',
        paidAt: new Date().toISOString()
      });

      // Update subscription status to active/paid with proper end date
      const now = new Date();
      const endDate = new Date();

      // Set end date based on plan
      if (planId === 'yearly_pro' || planId === 'yearly_basic' || planId === 'per_profile_yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1); // 1 year
      } else {
        endDate.setMonth(endDate.getMonth() + 1); // 1 month (default)
      }

      const updatedSubscription = subscriptionService.markSubscriptionAsPaid(gbpAccountId || subscription.gbpAccountId, {
        planId: planId || 'yearly_pro',
        profileCount: profileCount, // Store the profile count from payment
        lastPaymentDate: now.toISOString(),
        subscriptionEndDate: endDate.toISOString(),
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        amount: payment.amount / 100,
        currency: payment.currency
      });
      
      console.log('[Payment Verify] Subscription updated to active:', updatedSubscription);
      
      res.json({ 
        success: true, 
        message: 'Payment verified and subscription activated!',
        payment,
        subscription: updatedSubscription
      });
    } else {
      // Still return success even if no subscription found (shouldn't happen)
      console.warn('[Payment Verify] No subscription found for payment');
      res.json({ 
        success: true, 
        message: 'Payment verified successfully',
        payment 
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Cancel subscription
router.post('/subscription/cancel', async (req, res) => {
  try {
    const { subscriptionId, gbpAccountId } = req.body;
    
    if (!subscriptionId || !gbpAccountId) {
      return res.status(400).json({ error: 'subscriptionId and gbpAccountId are required' });
    }
    
    const subscription = subscriptionService.getSubscriptionByGBPAccount(gbpAccountId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    if (subscription.razorpaySubscriptionId) {
      await paymentService.cancelSubscription(subscription.razorpaySubscriptionId);
    }
    
    const updatedSubscription = subscriptionService.updateSubscription(subscription.id, {
      status: 'cancelled'
    });
    
    res.json({ 
      success: true,
      subscription: updatedSubscription 
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Store GBP-User association
router.post('/user/gbp-association', async (req, res) => {
  try {
    const { userId, gbpAccountId } = req.body;

    if (!userId || !gbpAccountId) {
      return res.status(400).json({ error: 'userId and gbpAccountId are required' });
    }

    console.log('[GBP Association] Saving user-GBP association:', { userId, gbpAccountId });

    // Save the association
    subscriptionService.persistentStorage.saveUserGbpMapping(userId, gbpAccountId);

    res.json({
      success: true,
      message: 'GBP association saved successfully'
    });
  } catch (error) {
    console.error('Error saving GBP association:', error);
    res.status(500).json({ error: 'Failed to save GBP association' });
  }
});

// Get payment history
router.get('/subscription/:gbpAccountId/payments', async (req, res) => {
  try {
    const { gbpAccountId } = req.params;

    const subscription = subscriptionService.getSubscriptionByGBPAccount(gbpAccountId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      payments: subscription.paymentHistory || []
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Webhook endpoint for Razorpay events
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
    const isValid = paymentService.verifyWebhookSignature(req.body, signature);
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    
    // Process webhook event
    await subscriptionService.handleWebhookEvent(req.body);
    
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});


export default router;
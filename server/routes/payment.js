import express from 'express';
import PaymentService from '../services/paymentService.js';
import SubscriptionService from '../services/subscriptionService.js';
import CouponService from '../services/couponService.js';

const router = express.Router();
const paymentService = new PaymentService();
const subscriptionService = new SubscriptionService();
const couponService = new CouponService();

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
    const { gbpAccountId } = req.query;
    
    if (!gbpAccountId) {
      return res.status(400).json({ error: 'GBP Account ID is required' });
    }
    
    const status = subscriptionService.checkSubscriptionStatus(gbpAccountId);
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
    const { code, amount } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }
    
    const result = couponService.applyCoupon(code, amount);
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

// Create Razorpay order
router.post('/order', async (req, res) => {
  try {
    const { amount, currency = 'INR', notes = {}, couponCode } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    let finalAmount = amount;
    let couponDetails = null;
    
    // Apply coupon if provided
    if (couponCode) {
      const couponResult = couponService.applyCoupon(couponCode, amount);
      if (couponResult.success) {
        finalAmount = couponResult.finalAmount;
        couponDetails = couponResult;
        notes.couponCode = couponCode;
        notes.originalAmount = amount;
        notes.discountAmount = couponResult.discountAmount;
        console.log(`Coupon ${couponCode} applied: Rs. ${amount} -> Rs. ${finalAmount}`);
      } else {
        return res.status(400).json({ error: couponResult.error });
      }
    }
    
    const order = await paymentService.createOrder(finalAmount, currency, notes);
    res.json({ 
      order,
      couponDetails,
      originalAmount: amount,
      finalAmount
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
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
      
      // Update subscription status to active/paid
      const updatedSubscription = subscriptionService.updateSubscription(subscription.id, {
        status: 'active',
        planId: planId || 'monthly_basic',
        lastPaymentDate: new Date().toISOString(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
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
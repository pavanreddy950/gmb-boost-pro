import SubscriptionService from '../services/subscriptionService.js';

const subscriptionService = new SubscriptionService();

/**
 * Middleware to check subscription status and enforce payment after trial expiry
 * IMPORTANT: This checks based on GBP Account ID, not user ID
 * This prevents users from creating multiple accounts to bypass payment
 */
export const checkSubscription = (req, res, next) => {
  // Get GBP Account ID from various sources
  const gbpAccountId = req.headers['x-gbp-account-id'] || 
                       req.query.gbpAccountId || 
                       req.body?.gbpAccountId ||
                       req.params?.locationId; // Some routes use locationId as GBP identifier

  // Allow certain routes without subscription check
  const exemptRoutes = [
    '/health',
    '/config',
    '/auth/google/url',
    '/auth/google/callback',
    '/api/payment', // Payment routes always accessible
    '/api/subscription/status', // Status check always accessible
    '/api/automation' // Automation endpoints for testing
  ];

  // Check if current route is exempt
  const isExempt = exemptRoutes.some(route => req.path.startsWith(route));
  
  if (isExempt) {
    return next();
  }

  // If no GBP Account ID, allow access (initial connection)
  if (!gbpAccountId || gbpAccountId === 'undefined' || gbpAccountId === 'null') {
    console.log('No GBP Account ID found, allowing access for initial connection');
    return next();
  }

  // Check subscription status
  const subscriptionStatus = subscriptionService.checkSubscriptionStatus(gbpAccountId);
  
  console.log(`[Subscription Check] GBP: ${gbpAccountId}, Status: ${subscriptionStatus.status}, Can Use: ${subscriptionStatus.canUsePlatform}`);

  // Attach subscription info to request
  req.subscription = subscriptionStatus;

  // If billing only mode (trial expired, no payment)
  if (subscriptionStatus.billingOnly === true) {
    // Only allow billing-related endpoints
    const billingRoutes = [
      '/api/payment',
      '/api/subscription',
      '/api/accounts' // Need this to show GBP info
    ];
    
    const isBillingRoute = billingRoutes.some(route => req.path.startsWith(route));
    
    if (!isBillingRoute) {
      return res.status(402).json({
        error: 'Payment Required',
        message: 'Your 15-day trial has expired. Please upgrade to continue using all features.',
        status: 'expired',
        billingOnly: true,
        requiresPayment: true,
        redirectTo: '/billing'
      });
    }
  }

  // If cannot use platform and not billing route
  if (subscriptionStatus.canUsePlatform === false) {
    return res.status(402).json({
      error: 'Subscription Required',
      message: subscriptionStatus.message || 'Please upgrade your subscription to continue.',
      status: subscriptionStatus.status,
      requiresPayment: true,
      redirectTo: '/billing'
    });
  }

  // All good, continue
  next();
};

/**
 * Middleware specifically for trial tracking
 * This creates a trial subscription when GBP is first connected
 */
export const trackTrialStart = async (req, res, next) => {
  const gbpAccountId = req.body?.gbpAccountId || req.headers['x-gbp-account-id'];
  const userId = req.body?.userId;
  const email = req.body?.email;

  if (gbpAccountId && userId && email) {
    try {
      // Check if subscription exists
      const existingStatus = subscriptionService.checkSubscriptionStatus(gbpAccountId);
      
      if (!existingStatus.subscription) {
        // Create trial subscription on first GBP connection
        console.log(`[Trial Tracking] Creating trial for GBP: ${gbpAccountId}`);
        const trial = await subscriptionService.createTrialSubscription(
          userId,
          gbpAccountId,
          email
        );
        console.log(`[Trial Tracking] Trial created:`, trial);
      }
    } catch (error) {
      console.error('[Trial Tracking] Error:', error);
    }
  }

  next();
};

/**
 * Add trial information to response headers
 */
export const addTrialHeaders = (req, res, next) => {
  if (req.subscription) {
    res.setHeader('X-Subscription-Status', req.subscription.status || 'none');
    if (req.subscription.daysRemaining !== undefined) {
      res.setHeader('X-Trial-Days-Remaining', req.subscription.daysRemaining.toString());
    }
    if (req.subscription.billingOnly) {
      res.setHeader('X-Billing-Only', 'true');
    }
  }
  next();
};

export default checkSubscription;
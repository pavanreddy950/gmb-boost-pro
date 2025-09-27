import SubscriptionService from '../services/subscriptionService.js';

const subscriptionService = new SubscriptionService();

// Middleware to check subscription status
export const checkSubscription = async (req, res, next) => {
  try {
    // Extract GBP Account ID from various sources
    let gbpAccountId = null;
    
    // Try to get from query params
    gbpAccountId = req.query.gbpAccountId;
    
    // Try to get from body
    if (!gbpAccountId && req.body) {
      gbpAccountId = req.body.gbpAccountId;
    }
    
    // Try to get from headers
    if (!gbpAccountId && req.headers['x-gbp-account-id']) {
      gbpAccountId = req.headers['x-gbp-account-id'];
    }
    
    // Try to extract from location parameter in URL
    if (!gbpAccountId && req.params.locationParam) {
      // Extract account ID from location parameter
      const locationParam = decodeURIComponent(req.params.locationParam);
      if (locationParam.includes('accounts/')) {
        const parts = locationParam.split('/');
        const accountIndex = parts.indexOf('accounts');
        if (accountIndex >= 0 && parts[accountIndex + 1]) {
          gbpAccountId = parts[accountIndex + 1];
        }
      }
    }
    
    // Try to extract from accountName parameter
    if (!gbpAccountId && req.params.accountName) {
      const accountName = req.params.accountName;
      if (accountName.includes('accounts/')) {
        gbpAccountId = accountName.split('/')[1];
      } else {
        gbpAccountId = accountName;
      }
    }
    
    // If no GBP Account ID found, allow the request (might be initial setup)
    if (!gbpAccountId) {
      console.log('No GBP Account ID found in request, allowing access');
      return next();
    }
    
    // Check subscription status
    const status = subscriptionService.checkSubscriptionStatus(gbpAccountId);
    
    // Store subscription info in request for later use
    req.subscription = status.subscription;
    req.subscriptionStatus = status;
    
    // Allow access if subscription is valid (trial or active)
    if (status.isValid) {
      console.log(`✅ Valid subscription for GBP account ${gbpAccountId}: ${status.status} (${status.daysRemaining} days remaining)`);
      return next();
    }
    
    // Block access if subscription is expired or none
    console.log(`❌ Invalid subscription for GBP account ${gbpAccountId}: ${status.status}`);
    
    return res.status(403).json({
      error: 'Subscription required',
      message: status.status === 'expired' 
        ? 'Your trial/subscription has expired. Please upgrade to continue using the service.'
        : 'No active subscription found. Please start a trial or subscribe to continue.',
      status: status.status,
      requiresPayment: true,
      gbpAccountId
    });
    
  } catch (error) {
    console.error('Subscription middleware error:', error);
    // Allow the request to proceed on error (fail open)
    next();
  }
};

// Middleware for endpoints that should always be accessible
export const bypassSubscription = (req, res, next) => {
  next();
};

// Middleware to add trial info to response headers
export const addTrialHeaders = (req, res, next) => {
  if (req.subscriptionStatus) {
    res.setHeader('X-Subscription-Status', req.subscriptionStatus.status);
    if (req.subscriptionStatus.daysRemaining !== undefined) {
      res.setHeader('X-Subscription-Days-Remaining', req.subscriptionStatus.daysRemaining.toString());
    }
  }
  next();
};

// List of endpoints that should bypass subscription check
export const BYPASS_ENDPOINTS = [
  '/health',
  '/config',
  '/auth/google/url',
  '/auth/google/callback',
  '/api/accounts', // Allow fetching accounts to set up trial
  '/api/payment/plans',
  '/api/payment/subscription/trial',
  '/api/payment/subscription/status',
  '/api/payment/order',
  '/api/payment/verify',
  '/api/payment/webhook'
];

// Check if endpoint should bypass subscription check
export const shouldBypassSubscription = (path) => {
  return BYPASS_ENDPOINTS.some(endpoint => path.startsWith(endpoint));
};

export default {
  checkSubscription,
  bypassSubscription,
  addTrialHeaders,
  shouldBypassSubscription
};
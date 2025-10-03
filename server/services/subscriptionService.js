import PaymentService from './paymentService.js';
import persistentSubscriptionService from './persistentSubscriptionService.js';

class SubscriptionService {
  constructor() {
    this.paymentService = new PaymentService();
    this.persistentStorage = persistentSubscriptionService;
    this.plans = new Map();
    this.initializePlans();
  }

  initializePlans() {
    // Define subscription plans
    // Keep old plans for backward compatibility
    this.plans.set('monthly_basic', {
      id: 'monthly_basic',
      name: 'Monthly Basic',
      amount: 999, // Rs. 999
      currency: 'INR',
      interval: 'monthly',
      features: [
        'Unlimited Google Business Profile Management',
        'Auto-Post Scheduling',
        'Review Management & Auto-Reply',
        'Performance Analytics',
        'Priority Support'
      ],
      trialDays: 15
    });

    this.plans.set('yearly_basic', {
      id: 'yearly_basic',
      name: 'Yearly Basic',
      amount: 9999, // Rs. 9999
      currency: 'INR',
      interval: 'yearly',
      features: [
        'All Monthly Features',
        '2 Months Free',
        'Advanced Analytics',
        'API Access',
        'Dedicated Support'
      ],
      trialDays: 15
    });

    // Current active plan
    this.plans.set('yearly_pro', {
      id: 'yearly_pro',
      name: 'Pro Plan',
      amount: 9900, // Rs. 99.00
      currency: 'INR',
      interval: 'yearly',
      features: [
        'Unlimited Google Business Profile Management',
        'Auto-Post Scheduling',
        'Review Management & Auto-Reply',
        'Performance Analytics',
        'Advanced Analytics',
        'API Access',
        'Priority Support',
        'Dedicated Support'
      ],
      trialDays: 15
    });
  }

  async createTrialSubscription(userId, gbpAccountId, email) {
    // Check if subscription already exists for this GBP account
    const existingSubscription = this.getSubscriptionByGBPAccount(gbpAccountId);
    if (existingSubscription) {
      console.log('Subscription already exists for GBP account:', gbpAccountId);
      return existingSubscription;
    }

    const now = new Date();
    const trialEndDate = new Date();
    // PRODUCTION MODE: 15 days trial
    trialEndDate.setDate(trialEndDate.getDate() + 15); // 15 days trial
    // TEST MODE: Uncomment below for 2 minutes trial for testing
    // trialEndDate.setMinutes(trialEndDate.getMinutes() + 2);

    const subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      gbpAccountId,
      email,
      status: 'trial',
      trialStartDate: now.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      paymentHistory: []
    };

    // Save to persistent storage
    this.persistentStorage.saveSubscription(subscription);
    console.log('Created trial subscription:', subscription);
    return subscription;
  }

  getSubscriptionByGBPAccount(gbpAccountId) {
    // Get from persistent storage
    return this.persistentStorage.getSubscriptionByGBPAccount(gbpAccountId);
  }

  getSubscriptionByUserId(userId) {
    // Use the new persistent storage method with user-GBP mapping
    return this.persistentStorage.getSubscriptionByUserId(userId);
  }

  getSubscriptionById(subscriptionId) {
    return this.persistentStorage.getSubscriptionById(subscriptionId);
  }

  updateSubscription(subscriptionId, updates) {
    const subscription = this.persistentStorage.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Update in persistent storage
    return this.persistentStorage.updateSubscription(subscription.gbpAccountId, updates);
  }

  checkSubscriptionStatus(gbpAccountId) {
    console.log('[SubscriptionService] Checking status for GBP:', gbpAccountId);
    const subscription = this.getSubscriptionByGBPAccount(gbpAccountId);
    
    if (!subscription) {
      console.log('[SubscriptionService] No subscription found for GBP:', gbpAccountId);
      return { 
        isValid: false, 
        status: 'none', 
        subscription: null,
        canUsePlatform: true, // Allow initial connection
        requiresPayment: false,
        billingOnly: false
      };
    }
    
    console.log('[SubscriptionService] Found subscription:', subscription);

    const now = new Date();
    
    if (subscription.status === 'trial') {
      const trialEndDate = new Date(subscription.trialEndDate);
      // PRODUCTION MODE: Calculate days remaining more accurately
      const timeDiff = trialEndDate - now;
      const exactDaysRemaining = timeDiff / (1000 * 60 * 60 * 24);

      // Use Math.floor for more accurate day counting (don't round up partial days)
      // But show at least 0 if there's still time left (even if less than a day)
      const daysRemaining = timeDiff > 0 ? Math.max(1, Math.floor(exactDaysRemaining)) : 0;

      // TEST MODE: Uncomment below to treat minutes as "days" for testing
      // const minutesRemaining = Math.ceil((trialEndDate - now) / (1000 * 60));
      // const daysRemaining = minutesRemaining;

      if (timeDiff > 0) {
        return { 
          isValid: true, 
          status: 'trial', 
          daysRemaining,
          subscription,
          canUsePlatform: true,
          requiresPayment: false,
          billingOnly: false,
          message: `Trial active: ${daysRemaining} days remaining`
        };
      } else {
        // Trial expired - ENFORCE PAYMENT
        this.persistentStorage.updateSubscription(subscription.gbpAccountId, { status: 'expired' });
        return { 
          isValid: false, 
          status: 'expired', 
          daysRemaining: 0,
          subscription: { ...subscription, status: 'expired' },
          canUsePlatform: false,
          requiresPayment: true,
          billingOnly: true, // ONLY BILLING PAGE ACCESSIBLE
          message: 'Your 15-day trial has expired. Please upgrade to continue.'
        };
      }
    }
    
    if (subscription.status === 'active' || subscription.status === 'paid') {
      if (subscription.subscriptionEndDate) {
        const endDate = new Date(subscription.subscriptionEndDate);
        const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining > 0) {
          return { 
            isValid: true, 
            status: 'active', 
            daysRemaining,
            subscription,
            canUsePlatform: true,
            requiresPayment: false,
            billingOnly: false,
            message: 'Subscription active'
          };
        } else {
          // Subscription expired
          this.updateSubscription(subscription.id, { status: 'expired' });
          return { 
            isValid: false, 
            status: 'expired', 
            daysRemaining: 0,
            subscription: { ...subscription, status: 'expired' },
            canUsePlatform: false,
            requiresPayment: true,
            billingOnly: true,
            message: 'Subscription expired. Please renew to continue.'
          };
        }
      }
      
      return { 
        isValid: true, 
        status: 'active',
        subscription,
        canUsePlatform: true,
        requiresPayment: false,
        billingOnly: false,
        message: 'Subscription active'
      };
    }
    
    // For any other status (expired, cancelled, etc.)
    return { 
      isValid: false, 
      status: subscription.status,
      subscription,
      canUsePlatform: false,
      requiresPayment: true,
      billingOnly: true,
      message: 'Please upgrade to continue using the platform'
    };
  }

  // Check subscription status by subscription object (used for user ID lookups)
  checkSubscriptionStatusBySubscription(subscription) {
    if (!subscription) {
      return {
        isValid: false,
        status: 'none',
        subscription: null,
        canUsePlatform: true,
        requiresPayment: false,
        billingOnly: false
      };
    }

    const now = new Date();

    if (subscription.status === 'trial') {
      const trialEndDate = new Date(subscription.trialEndDate);
      const timeDiff = trialEndDate - now;
      const exactDaysRemaining = timeDiff / (1000 * 60 * 60 * 24);

      // Use Math.floor for more accurate day counting (don't round up partial days)
      // But show at least 0 if there's still time left (even if less than a day)
      const daysRemaining = timeDiff > 0 ? Math.max(1, Math.floor(exactDaysRemaining)) : 0;

      if (timeDiff > 0) {
        return {
          isValid: true,
          status: 'trial',
          daysRemaining,
          subscription,
          canUsePlatform: true,
          requiresPayment: false,
          billingOnly: false,
          message: `Trial active: ${daysRemaining} days remaining`
        };
      } else {
        // Trial expired
        this.persistentStorage.updateSubscription(subscription.gbpAccountId, { status: 'expired' });
        return {
          isValid: false,
          status: 'expired',
          daysRemaining: 0,
          subscription: { ...subscription, status: 'expired' },
          canUsePlatform: false,
          requiresPayment: true,
          billingOnly: true,
          message: 'Your 15-day trial has expired. Please upgrade to continue.'
        };
      }
    }

    if (subscription.status === 'active' || subscription.status === 'paid') {
      if (subscription.subscriptionEndDate) {
        const endDate = new Date(subscription.subscriptionEndDate);
        const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        if (daysRemaining > 0) {
          return {
            isValid: true,
            status: 'active',
            daysRemaining,
            subscription,
            canUsePlatform: true,
            requiresPayment: false,
            billingOnly: false,
            message: 'Subscription active'
          };
        } else {
          // Subscription expired
          this.updateSubscription(subscription.id, { status: 'expired' });
          return {
            isValid: false,
            status: 'expired',
            daysRemaining: 0,
            subscription: { ...subscription, status: 'expired' },
            canUsePlatform: false,
            requiresPayment: true,
            billingOnly: true,
            message: 'Subscription expired. Please renew to continue.'
          };
        }
      }

      return {
        isValid: true,
        status: 'active',
        subscription,
        canUsePlatform: true,
        requiresPayment: false,
        billingOnly: false,
        message: 'Subscription active'
      };
    }

    // For any other status (expired, cancelled, etc.)
    return {
      isValid: false,
      status: subscription.status,
      subscription,
      canUsePlatform: false,
      requiresPayment: true,
      billingOnly: true,
      message: 'Please upgrade to continue using the platform'
    };
  }

  markSubscriptionAsPaid(gbpAccountId, paymentDetails) {
    const subscription = this.getSubscriptionByGBPAccount(gbpAccountId);
    if (!subscription) {
      throw new Error('No subscription found for this GBP account');
    }

    const now = new Date();
    let endDate;

    // Use provided subscriptionEndDate or calculate based on plan
    if (paymentDetails.subscriptionEndDate) {
      // Use the provided end date (already calculated in payment route)
      endDate = paymentDetails.subscriptionEndDate;
    } else {
      // Calculate end date based on plan
      endDate = new Date();
      if (paymentDetails.planId) {
        const plan = this.plans.get(paymentDetails.planId);
        if (plan) {
          if (plan.interval === 'monthly') {
            endDate.setMonth(endDate.getMonth() + 1);
          } else if (plan.interval === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
          }
        } else {
          // Handle per_profile_yearly and other yearly plans
          if (paymentDetails.planId.includes('yearly') || paymentDetails.planId === 'per_profile_yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
          } else {
            endDate.setMonth(endDate.getMonth() + 1);
          }
        }
      } else {
        // Default to 1 month if no plan specified
        endDate.setMonth(endDate.getMonth() + 1);
      }
      endDate = endDate.toISOString();
    }

    // Update subscription to paid/active status with proper end date
    return this.persistentStorage.updateSubscription(gbpAccountId, {
      status: 'active',
      ...paymentDetails,
      subscriptionStartDate: now.toISOString(),
      subscriptionEndDate: endDate,
      paidAt: now.toISOString()
    });
  }

  async activateSubscription(subscriptionId, planId, razorpaySubscriptionId, razorpayCustomerId) {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error('Invalid plan ID');
    }
    
    const subscription = this.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const now = new Date();
    const endDate = new Date();
    
    if (plan.interval === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    return this.persistentStorage.updateSubscription(subscription.gbpAccountId, {
      status: 'active',
      planId,
      planName: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      razorpaySubscriptionId,
      razorpayCustomerId,
      subscriptionStartDate: now.toISOString(),
      subscriptionEndDate: endDate.toISOString()
    });
  }

  addPaymentRecord(subscriptionId, payment) {
    const subscription = this.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const paymentRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...payment,
      createdAt: new Date().toISOString()
    };

    subscription.paymentHistory = subscription.paymentHistory || [];
    subscription.paymentHistory.push(paymentRecord);
    
    // Update in persistent storage
    this.persistentStorage.updateSubscription(subscription.gbpAccountId, {
      paymentHistory: subscription.paymentHistory
    });
    
    return paymentRecord;
  }

  getPlans() {
    return Array.from(this.plans.values());
  }

  getPlan(planId) {
    return this.plans.get(planId) || null;
  }

  calculateTrialDaysRemaining(trialEndDate) {
    const now = new Date();
    const endDate = new Date(trialEndDate);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  }

  async handleWebhookEvent(event) {
    console.log('Processing webhook event:', event.event);
    
    switch (event.event) {
      case 'subscription.authenticated':
      case 'subscription.activated':
        // Handle subscription activation
        const subscription = await this.paymentService.getSubscription(event.payload.subscription.entity.id);
        // Update subscription status in database
        break;
        
      case 'subscription.charged':
        // Handle successful payment
        const payment = event.payload.payment.entity;
        // Add payment record
        break;
        
      case 'subscription.cancelled':
      case 'subscription.expired':
        // Handle subscription cancellation/expiry
        // Update subscription status
        break;
        
      default:
        console.log('Unhandled webhook event:', event.event);
    }
  }
}

export default SubscriptionService;
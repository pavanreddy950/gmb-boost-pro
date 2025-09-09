import PaymentService from './paymentService.js';

class SubscriptionService {
  constructor() {
    this.paymentService = new PaymentService();
    this.subscriptions = new Map(); // In-memory storage (should use database in production)
    this.plans = new Map();
    this.initializePlans();
  }

  initializePlans() {
    // Define subscription plans
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
    trialEndDate.setDate(trialEndDate.getDate() + 15); // 15 days trial

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

    this.subscriptions.set(subscription.id, subscription);
    console.log('Created trial subscription:', subscription);
    return subscription;
  }

  getSubscriptionByGBPAccount(gbpAccountId) {
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.gbpAccountId === gbpAccountId) {
        return subscription;
      }
    }
    return null;
  }

  getSubscriptionByUserId(userId) {
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.userId === userId) {
        return subscription;
      }
    }
    return null;
  }

  getSubscriptionById(subscriptionId) {
    return this.subscriptions.get(subscriptionId) || null;
  }

  updateSubscription(subscriptionId, updates) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const updatedSubscription = {
      ...subscription,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.subscriptions.set(subscriptionId, updatedSubscription);
    return updatedSubscription;
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
      const daysRemaining = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining > 0) {
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
        this.updateSubscription(subscription.id, { status: 'expired' });
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

  markSubscriptionAsPaid(gbpAccountId, paymentDetails) {
    const subscription = this.getSubscriptionByGBPAccount(gbpAccountId);
    if (!subscription) {
      throw new Error('No subscription found for this GBP account');
    }
    
    // Update subscription to paid/active status
    return this.updateSubscription(subscription.id, {
      status: 'active',
      ...paymentDetails,
      paidAt: new Date().toISOString()
    });
  }

  async activateSubscription(subscriptionId, planId, razorpaySubscriptionId, razorpayCustomerId) {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error('Invalid plan ID');
    }

    const now = new Date();
    const endDate = new Date();
    
    if (plan.interval === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    return this.updateSubscription(subscriptionId, {
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
    const subscription = this.subscriptions.get(subscriptionId);
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
    
    this.subscriptions.set(subscriptionId, subscription);
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
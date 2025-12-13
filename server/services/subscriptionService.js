import PaymentService from './paymentService.js';
import supabaseSubscriptionService from './supabaseSubscriptionService.js';

class SubscriptionService {
  constructor() {
    this.paymentService = new PaymentService();
    this.persistentStorage = supabaseSubscriptionService; // Using Supabase PostgreSQL for persistent storage
    this.plans = new Map();
    this.initializePlans();

    // Initialize Supabase storage
    this.persistentStorage.initialize().catch(err => {
      console.error('[SubscriptionService] Failed to initialize Supabase storage:', err);
    });
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
    // CRITICAL: Check by EMAIL first to prevent duplicate subscriptions
    // When users add new profiles, gbpAccountId might change, but email stays same
    console.log('[createTrialSubscription] Checking for existing subscription - email:', email, 'gbpAccountId:', gbpAccountId);

    // Check by email first (one subscription per user)
    let existingSubscription = await this.persistentStorage.getSubscriptionByEmail?.(email);

    if (!existingSubscription) {
      // Fallback: Check by GBP account ID
      existingSubscription = await this.getSubscriptionByGBPAccount(gbpAccountId);
    }

    if (existingSubscription) {
      console.log('[createTrialSubscription] ✅ Subscription already exists:', {
        id: existingSubscription.id,
        email: existingSubscription.email,
        status: existingSubscription.status,
        paidSlots: existingSubscription.paidSlots,
        gbpAccountId: existingSubscription.gbpAccountId
      });

      // Update gbpAccountId if it changed (user reconnected with different account)
      if (existingSubscription.gbpAccountId !== gbpAccountId) {
        console.log('[createTrialSubscription] 🔄 Updating gbpAccountId from', existingSubscription.gbpAccountId, 'to', gbpAccountId);
        await this.persistentStorage.updateSubscription(existingSubscription.gbpAccountId, {
          gbpAccountId: gbpAccountId
        });
        existingSubscription.gbpAccountId = gbpAccountId;
      }

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

    // Save to persistent storage (both Firestore and file)
    await this.persistentStorage.saveSubscription(subscription);
    console.log('Created trial subscription:', subscription);
    return subscription;
  }

  async getSubscriptionByGBPAccount(gbpAccountId) {
    // Get from hybrid storage (Firestore first, then file)
    return await this.persistentStorage.getSubscriptionByGBPAccount(gbpAccountId);
  }

  async getSubscriptionByUserId(userId) {
    // Use the hybrid storage method with user-GBP mapping
    return await this.persistentStorage.getSubscriptionByUserId(userId);
  }

  async getSubscriptionById(subscriptionId) {
    return await this.persistentStorage.getSubscriptionById(subscriptionId);
  }

  async updateSubscription(subscriptionId, updates) {
    const subscription = await this.persistentStorage.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Update in hybrid storage (both Firestore and file)
    return await this.persistentStorage.updateSubscription(subscription.gbpAccountId, updates);
  }

  async checkSubscriptionStatus(gbpAccountId) {
    console.log('[SubscriptionService] Checking status for GBP:', gbpAccountId);
    const subscription = await this.getSubscriptionByGBPAccount(gbpAccountId);
    
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
        await this.persistentStorage.updateSubscription(subscription.gbpAccountId, { status: 'expired' });
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
          await this.updateSubscription(subscription.id, { status: 'expired' });
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
  async checkSubscriptionStatusBySubscription(subscription) {
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
        await this.persistentStorage.updateSubscription(subscription.gbpAccountId, { status: 'expired' });
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
          await this.updateSubscription(subscription.id, { status: 'expired' });
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

  async markSubscriptionAsPaid(gbpAccountId, paymentDetails) {
    const subscription = await this.getSubscriptionByGBPAccount(gbpAccountId);
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
    return await this.persistentStorage.updateSubscription(gbpAccountId, {
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

    const subscription = await this.getSubscriptionById(subscriptionId);
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

    return await this.persistentStorage.updateSubscription(subscription.gbpAccountId, {
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

  async addPaymentRecord(subscriptionId, payment) {
    const subscription = await this.getSubscriptionById(subscriptionId);
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

    // Update in hybrid storage (both Firestore and file)
    await this.persistentStorage.updateSubscription(subscription.gbpAccountId, {
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
    console.log('[Webhook] Processing event:', event.event);

    try {
      switch (event.event) {
        case 'subscription.authenticated':
        case 'subscription.activated': {
          // Handle subscription activation
          console.log('[Webhook] Subscription activated/authenticated');
          const razorpaySubId = event.payload.subscription?.entity?.id;
          if (razorpaySubId) {
            const razorpaySub = await this.paymentService.getSubscription(razorpaySubId);
            console.log('[Webhook] Razorpay subscription details:', razorpaySub);

            // Find our local subscription by Razorpay subscription ID
            const allSubs = await this.persistentStorage.getAllSubscriptions();
            const localSub = allSubs.find(s => s.razorpaySubscriptionId === razorpaySubId);

            if (localSub) {
              await this.persistentStorage.updateSubscription(localSub.gbpAccountId, {
                status: 'active',
                razorpaySubscriptionId: razorpaySubId
              });
              console.log('[Webhook] ✅ Subscription activated:', localSub.gbpAccountId);
            }
          }
          break;
        }

        case 'subscription.charged': {
          // Handle successful recurring payment - AUTO RENEWAL
          console.log('[Webhook] 💰 Subscription charged (auto-renewal)');
          const paymentEntity = event.payload.payment?.entity;
          const subscriptionEntity = event.payload.subscription?.entity;

          if (paymentEntity && subscriptionEntity) {
            const razorpaySubId = subscriptionEntity.id;

            // Find local subscription by Razorpay subscription ID
            const allSubs = await this.persistentStorage.getAllSubscriptions();
            const localSub = allSubs.find(s => s.razorpaySubscriptionId === razorpaySubId);

            if (localSub) {
              // Calculate new end date (extend by 1 year for yearly plans)
              const now = new Date();
              const newEndDate = new Date();

              // Check plan type and extend accordingly
              if (localSub.planId?.includes('yearly') || localSub.planId === 'per_profile_yearly') {
                newEndDate.setFullYear(newEndDate.getFullYear() + 1);
              } else {
                newEndDate.setMonth(newEndDate.getMonth() + 1);
              }

              // Update subscription with new end date
              await this.persistentStorage.updateSubscription(localSub.gbpAccountId, {
                status: 'active',
                subscriptionEndDate: newEndDate.toISOString(),
                lastPaymentDate: now.toISOString(),
                razorpayPaymentId: paymentEntity.id
              });

              // Add payment record
              await this.addPaymentRecord(localSub.id, {
                amount: paymentEntity.amount / 100, // Razorpay amounts are in paise
                currency: paymentEntity.currency,
                status: 'captured',
                razorpayPaymentId: paymentEntity.id,
                razorpayOrderId: paymentEntity.order_id,
                description: 'Auto-renewal payment',
                paidAt: now.toISOString()
              });

              console.log('[Webhook] ✅ Auto-renewal successful for:', localSub.gbpAccountId);
              console.log('[Webhook] New end date:', newEndDate.toISOString());
            } else {
              console.warn('[Webhook] ⚠️ No local subscription found for Razorpay sub:', razorpaySubId);
            }
          }
          break;
        }

        case 'subscription.cancelled':
        case 'subscription.expired': {
          // Handle subscription cancellation/expiry
          console.log('[Webhook] Subscription cancelled/expired');
          const razorpaySubId = event.payload.subscription?.entity?.id;

          if (razorpaySubId) {
            const allSubs = await this.persistentStorage.getAllSubscriptions();
            const localSub = allSubs.find(s => s.razorpaySubscriptionId === razorpaySubId);

            if (localSub) {
              const newStatus = event.event === 'subscription.cancelled' ? 'cancelled' : 'expired';
              await this.persistentStorage.updateSubscription(localSub.gbpAccountId, {
                status: newStatus,
                cancelledAt: new Date().toISOString()
              });
              console.log(`[Webhook] ✅ Subscription ${newStatus}:`, localSub.gbpAccountId);
            }
          }
          break;
        }

        case 'payment.captured': {
          // Handle one-time payment capture
          console.log('[Webhook] Payment captured');
          const paymentEntity = event.payload.payment?.entity;
          if (paymentEntity) {
            console.log('[Webhook] Payment ID:', paymentEntity.id, 'Amount:', paymentEntity.amount / 100);
          }
          break;
        }

        default:
          console.log('[Webhook] Unhandled event:', event.event);
      }
    } catch (error) {
      console.error('[Webhook] Error processing event:', error);
      throw error;
    }
  }
}

export default SubscriptionService;
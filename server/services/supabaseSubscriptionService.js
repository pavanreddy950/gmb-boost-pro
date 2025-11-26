import supabaseConfig from '../config/supabase.js';

/**
 * Supabase Subscription Service
 * Replaces persistentSubscriptionService.js JSON file storage
 * Stores subscriptions and payment history in PostgreSQL
 */
class SupabaseSubscriptionService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized && this.client) {
      return this.client;
    }

    try {
      this.client = await supabaseConfig.ensureInitialized();
      this.initialized = true;
      console.log('[SupabaseSubscriptionService] ✅ Initialized');
      return this.client;
    } catch (error) {
      console.error('[SupabaseSubscriptionService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Save subscription to Supabase
   */
  async saveSubscription(subscription) {
    try {
      await this.initialize();

      if (!subscription.id || !subscription.gbpAccountId) {
        throw new Error('Subscription must have id and gbpAccountId');
      }

      console.log(`[SupabaseSubscriptionService] 💾 Saving subscription: ${subscription.id}`);

      // Extract payment history to save separately
      const paymentHistory = subscription.paymentHistory || [];
      
      // Prepare subscription data
      const subscriptionData = {
        id: subscription.id,
        user_id: subscription.userId,
        gbp_account_id: subscription.gbpAccountId,
        email: subscription.email,
        status: subscription.status,
        plan_id: subscription.planId,
        profile_count: subscription.profileCount || 0,
        trial_start_date: subscription.trialStartDate,
        trial_end_date: subscription.trialEndDate,
        subscription_start_date: subscription.subscriptionStartDate,
        subscription_end_date: subscription.subscriptionEndDate,
        last_payment_date: subscription.lastPaymentDate,
        razorpay_payment_id: subscription.razorpayPaymentId,
        razorpay_order_id: subscription.razorpayOrderId,
        amount: subscription.amount,
        currency: subscription.currency,
        paid_at: subscription.paidAt,
        cancelled_at: subscription.cancelledAt,
        cancelled_by: subscription.cancelledBy,
        created_at: subscription.createdAt,
        updated_at: subscription.updatedAt || new Date().toISOString()
      };

      // Upsert subscription
      const { error: subError } = await this.client
        .from('subscriptions')
        .upsert(subscriptionData, { onConflict: 'id' });

      if (subError) {
        console.error('[SupabaseSubscriptionService] ❌ Error saving subscription:', subError);
        throw subError;
      }

      // Save payment history
      if (paymentHistory.length > 0) {
        await this.savePaymentHistory(subscription.id, paymentHistory);
      }

      console.log(`[SupabaseSubscriptionService] ✅ Subscription saved: ${subscription.id}`);
      return subscription;
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error saving subscription:', error);
      throw error;
    }
  }

  /**
   * Save payment history
   */
  async savePaymentHistory(subscriptionId, paymentHistory) {
    try {
      await this.initialize();

      const payments = paymentHistory.map(payment => ({
        id: payment.id,
        subscription_id: subscriptionId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        razorpay_payment_id: payment.razorpayPaymentId,
        razorpay_order_id: payment.razorpayOrderId,
        razorpay_signature: payment.razorpaySignature,
        description: payment.description,
        paid_at: payment.paidAt,
        created_at: payment.createdAt || new Date().toISOString()
      }));

      const { error } = await this.client
        .from('payment_history')
        .upsert(payments, { onConflict: 'id' });

      if (error) {
        console.error('[SupabaseSubscriptionService] ❌ Error saving payment history:', error);
        throw error;
      }

      console.log(`[SupabaseSubscriptionService] ✅ Saved ${payments.length} payment records`);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error saving payment history:', error);
      throw error;
    }
  }

  /**
   * Get subscription by GBP Account ID
   */
  async getSubscriptionByGbpId(gbpAccountId) {
    try {
      await this.initialize();

      const { data: subscription, error: subError } = await this.client
        .from('subscriptions')
        .select('*')
        .eq('gbp_account_id', gbpAccountId)
        .single();

      if (subError) {
        if (subError.code === 'PGRST116') {
          // No rows found
          return null;
        }
        throw subError;
      }

      if (!subscription) {
        return null;
      }

      // Fetch payment history
      const { data: payments, error: payError } = await this.client
        .from('payment_history')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: false });

      // Convert to expected format
      return this.formatSubscription(subscription, payments || []);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting subscription:', error);
      return null;
    }
  }

  /**
   * Get subscription by User ID
   */
  async getSubscriptionByUserId(userId) {
    try {
      await this.initialize();

      const { data: subscriptions, error } = await this.client
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      if (!subscriptions || subscriptions.length === 0) {
        return null;
      }

      // Get the most recent active subscription
      const activeSubscription = subscriptions.find(s => s.status === 'active') || subscriptions[0];

      // Fetch payment history
      const { data: payments } = await this.client
        .from('payment_history')
        .select('*')
        .eq('subscription_id', activeSubscription.id)
        .order('created_at', { ascending: false });

      return this.formatSubscription(activeSubscription, payments || []);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting subscription by user:', error);
      return null;
    }
  }

  /**
   * Get all subscriptions
   */
  async getAllSubscriptions() {
    try {
      await this.initialize();

      const { data: subscriptions, error } = await this.client
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch payment history for all
      const subscriptionsWithPayments = await Promise.all(
        subscriptions.map(async (sub) => {
          const { data: payments } = await this.client
            .from('payment_history')
            .select('*')
            .eq('subscription_id', sub.id)
            .order('created_at', { ascending: false });

          return this.formatSubscription(sub, payments || []);
        })
      );

      return subscriptionsWithPayments;
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting all subscriptions:', error);
      return [];
    }
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(gbpAccountId, status) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('subscriptions')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('gbp_account_id', gbpAccountId);

      if (error) throw error;

      console.log(`[SupabaseSubscriptionService] ✅ Updated status to ${status} for ${gbpAccountId}`);
      return true;
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error updating status:', error);
      return false;
    }
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(gbpAccountId) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('subscriptions')
        .delete()
        .eq('gbp_account_id', gbpAccountId);

      if (error) throw error;

      console.log(`[SupabaseSubscriptionService] ✅ Deleted subscription: ${gbpAccountId}`);
      return true;
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error deleting subscription:', error);
      return false;
    }
  }

  /**
   * Save user-GBP mapping
   */
  async saveUserGbpMapping(userId, gbpAccountId) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('user_gbp_mapping')
        .upsert({
          user_id: userId,
          gbp_account_id: gbpAccountId
        }, {
          onConflict: 'user_id, gbp_account_id'
        });

      if (error) throw error;

      console.log(`[SupabaseSubscriptionService] ✅ Saved mapping: ${userId} → ${gbpAccountId}`);
      return true;
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error saving mapping:', error);
      return false;
    }
  }

  /**
   * Get GBP Account IDs for user
   */
  async getGbpAccountIdsForUser(userId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_gbp_mapping')
        .select('gbp_account_id')
        .eq('user_id', userId);

      if (error) throw error;

      return data ? data.map(m => m.gbp_account_id) : [];
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting GBP IDs:', error);
      return [];
    }
  }

  /**
   * Format subscription from database to expected format
   */
  formatSubscription(subscription, payments = []) {
    return {
      id: subscription.id,
      userId: subscription.user_id,
      gbpAccountId: subscription.gbp_account_id,
      email: subscription.email,
      status: subscription.status,
      planId: subscription.plan_id,
      profileCount: subscription.profile_count,
      trialStartDate: subscription.trial_start_date,
      trialEndDate: subscription.trial_end_date,
      subscriptionStartDate: subscription.subscription_start_date,
      subscriptionEndDate: subscription.subscription_end_date,
      lastPaymentDate: subscription.last_payment_date,
      razorpayPaymentId: subscription.razorpay_payment_id,
      razorpayOrderId: subscription.razorpay_order_id,
      amount: subscription.amount,
      currency: subscription.currency,
      paidAt: subscription.paid_at,
      cancelledAt: subscription.cancelled_at,
      cancelledBy: subscription.cancelled_by,
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at,
      paymentHistory: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        razorpayPaymentId: p.razorpay_payment_id,
        razorpayOrderId: p.razorpay_order_id,
        razorpaySignature: p.razorpay_signature,
        description: p.description,
        paidAt: p.paid_at,
        createdAt: p.created_at
      }))
    };
  }

  /**
   * Alias method for compatibility with subscriptionService.js
   */
  async getSubscriptionByGBPAccount(gbpAccountId) {
    return await this.getSubscriptionByGbpId(gbpAccountId);
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(subscriptionId) {
    try {
      await this.initialize();

      const { data: subscription, error } = await this.client
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!subscription) {
        return null;
      }

      // Fetch payment history
      const { data: payments } = await this.client
        .from('payment_history')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: false });

      return this.formatSubscription(subscription, payments || []);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting subscription by ID:', error);
      return null;
    }
  }

  /**
   * Update subscription (generic update method)
   */
  async updateSubscription(gbpAccountId, updates) {
    try {
      await this.initialize();

      // Map camelCase to snake_case
      const mappedUpdates = {
        updated_at: new Date().toISOString()
      };

      if (updates.status) mappedUpdates.status = updates.status;
      if (updates.planId) mappedUpdates.plan_id = updates.planId;
      if (updates.profileCount !== undefined) mappedUpdates.profile_count = updates.profileCount;
      if (updates.trialStartDate) mappedUpdates.trial_start_date = updates.trialStartDate;
      if (updates.trialEndDate) mappedUpdates.trial_end_date = updates.trialEndDate;
      if (updates.subscriptionStartDate) mappedUpdates.subscription_start_date = updates.subscriptionStartDate;
      if (updates.subscriptionEndDate) mappedUpdates.subscription_end_date = updates.subscriptionEndDate;
      if (updates.lastPaymentDate) mappedUpdates.last_payment_date = updates.lastPaymentDate;
      if (updates.razorpayPaymentId) mappedUpdates.razorpay_payment_id = updates.razorpayPaymentId;
      if (updates.razorpayOrderId) mappedUpdates.razorpay_order_id = updates.razorpayOrderId;
      if (updates.amount) mappedUpdates.amount = updates.amount;
      if (updates.currency) mappedUpdates.currency = updates.currency;
      if (updates.paidAt) mappedUpdates.paid_at = updates.paidAt;
      if (updates.cancelledAt) mappedUpdates.cancelled_at = updates.cancelledAt;
      if (updates.cancelledBy) mappedUpdates.cancelled_by = updates.cancelledBy;
      // Razorpay subscription fields for auto-renewal
      if (updates.razorpaySubscriptionId) mappedUpdates.razorpay_subscription_id = updates.razorpaySubscriptionId;
      if (updates.razorpayCustomerId) mappedUpdates.razorpay_customer_id = updates.razorpayCustomerId;
      if (updates.mandateAuthorized !== undefined) mappedUpdates.mandate_authorized = updates.mandateAuthorized;
      if (updates.mandateTokenId) mappedUpdates.mandate_token_id = updates.mandateTokenId;
      if (updates.mandateAuthDate) mappedUpdates.mandate_auth_date = updates.mandateAuthDate;

      const { data, error } = await this.client
        .from('subscriptions')
        .update(mappedUpdates)
        .eq('gbp_account_id', gbpAccountId)
        .select()
        .single();

      if (error) throw error;

      console.log(`[SupabaseSubscriptionService] ✅ Updated subscription: ${gbpAccountId}`);

      // Fetch payment history
      const { data: payments } = await this.client
        .from('payment_history')
        .select('*')
        .eq('subscription_id', data.id)
        .order('created_at', { ascending: false});

      return this.formatSubscription(data, payments || []);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Check subscription status
   */
  async checkStatus(gbpAccountId) {
    const subscription = await this.getSubscriptionByGbpId(gbpAccountId);

    if (!subscription) {
      return {
        isValid: false,
        status: 'not_found',
        message: 'No subscription found'
      };
    }

    const now = new Date();
    const endDate = subscription.subscriptionEndDate ? new Date(subscription.subscriptionEndDate) : null;
    const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;

    // Check if active subscription is still valid
    if (subscription.status === 'active' && endDate && endDate > now) {
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      return {
        isValid: true,
        status: 'active',
        daysRemaining,
        subscription,
        canUsePlatform: true,
        requiresPayment: false,
        message: 'Subscription active'
      };
    }

    // Check if in trial period
    if (subscription.status === 'trial' && trialEndDate && trialEndDate > now) {
      const daysRemaining = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
      return {
        isValid: true,
        status: 'trial',
        daysRemaining,
        subscription,
        canUsePlatform: true,
        requiresPayment: false,
        message: `Trial active - ${daysRemaining} days remaining`
      };
    }

    // Expired
    return {
      isValid: false,
      status: subscription.status === 'trial' ? 'trial_expired' : 'expired',
      subscription,
      canUsePlatform: false,
      requiresPayment: true,
      message: 'Subscription expired'
    };
  }
}

// Create singleton instance
const supabaseSubscriptionService = new SupabaseSubscriptionService();

export default supabaseSubscriptionService;





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
        paid_slots: subscription.paidSlots || 0, // CRITICAL: Total paid slots (never decreases)
        paid_location_ids: subscription.paidLocationIds || [], // Track which locations are paid
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
   * Updated to use 'users' table instead of non-existent 'subscriptions' table
   */
  async getSubscriptionByGbpId(gbpAccountId) {
    try {
      await this.initialize();

      // Look up user by google_account_id in users table
      const { data: user, error } = await this.client
        .from('users')
        .select('*')
        .eq('google_account_id', gbpAccountId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[SupabaseSubscriptionService] Error getting subscription by GBP ID:', error);
        return null;
      }

      if (!user) {
        return null;
      }

      // Convert users table format to subscription format
      return this.formatUserAsSubscription(user);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting subscription:', error);
      return null;
    }
  }

  /**
   * Get subscription by Email
   * Updated to use 'users' table instead of non-existent 'subscriptions' table
   */
  async getSubscriptionByEmail(email) {
    try {
      await this.initialize();

      const { data: user, error } = await this.client
        .from('users')
        .select('*')
        .ilike('gmail_id', email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[SupabaseSubscriptionService] Error getting subscription by email:', error);
        return null;
      }

      if (!user) {
        return null;
      }

      return this.formatUserAsSubscription(user);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting subscription by email:', error);
      return null;
    }
  }

  /**
   * Format user record as subscription (for backward compatibility)
   */
  formatUserAsSubscription(user) {
    return {
      id: user.id || user.firebase_uid,
      userId: user.firebase_uid,
      gbpAccountId: user.google_account_id,
      email: user.gmail_id,
      status: user.subscription_status || 'trial',
      planId: 'standard',
      profileCount: user.profile_count || 0,
      paidSlots: user.profile_count || 0,
      trialStartDate: user.trial_start_date,
      trialEndDate: user.trial_end_date,
      subscriptionStartDate: user.subscription_start_date,
      subscriptionEndDate: user.subscription_end_date,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      paymentHistory: [] // Payment history not stored in users table
    };
  }

  /**
   * Get subscription by User ID
   * Updated to use 'users' table instead of non-existent 'subscriptions' table
   */
  async getSubscriptionByUserId(userId) {
    try {
      await this.initialize();

      // Try by firebase_uid first
      let user = null;
      const { data: userByUid, error: uidError } = await this.client
        .from('users')
        .select('*')
        .eq('firebase_uid', userId)
        .maybeSingle();

      if (!uidError && userByUid) {
        user = userByUid;
      }

      // If not found and userId looks like email, try by email
      if (!user && userId && userId.includes('@')) {
        const { data: userByEmail, error: emailError } = await this.client
          .from('users')
          .select('*')
          .ilike('gmail_id', userId)
          .maybeSingle();

        if (!emailError && userByEmail) {
          user = userByEmail;
        }
      }

      if (!user) {
        return null;
      }

      return this.formatUserAsSubscription(user);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting subscription by user:', error);
      return null;
    }
  }

  /**
   * Get all subscriptions
   * Updated to use 'users' table instead of non-existent 'subscriptions' table
   */
  async getAllSubscriptions() {
    try {
      await this.initialize();

      const { data: users, error } = await this.client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert users to subscription format
      return (users || []).map(user => this.formatUserAsSubscription(user));
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting all subscriptions:', error);
      return [];
    }
  }

  /**
   * Update subscription status
   * Updated to use 'users' table instead of non-existent 'subscriptions' table
   */
  async updateSubscriptionStatus(gbpAccountId, status) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('users')
        .update({
          subscription_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('google_account_id', gbpAccountId);

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
   * Updated to use 'users' table instead of non-existent 'user_gbp_mapping' table
   */
  async saveUserGbpMapping(userId, gbpAccountId) {
    try {
      await this.initialize();

      // Store GBP account ID in users table using google_account_id column
      // Try by firebase_uid first, then by email
      let updateResult;

      if (userId && !userId.includes('@')) {
        // userId is a firebase_uid
        updateResult = await this.client
          .from('users')
          .update({ google_account_id: gbpAccountId })
          .eq('firebase_uid', userId);
      } else if (userId && userId.includes('@')) {
        // userId is an email
        updateResult = await this.client
          .from('users')
          .update({ google_account_id: gbpAccountId })
          .ilike('gmail_id', userId);
      }

      if (updateResult?.error) {
        console.warn('[SupabaseSubscriptionService] Could not update users table:', updateResult.error.message);
        // Don't throw - this is not critical
      } else {
        console.log(`[SupabaseSubscriptionService] ✅ Saved GBP mapping to users table: ${userId} → ${gbpAccountId}`);
      }

      return true;
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error saving mapping:', error);
      // Don't throw - this is not critical for the app to function
      return false;
    }
  }

  /**
   * Get GBP Account IDs for user
   * Updated to use 'users' table instead of non-existent 'user_gbp_mapping' table
   */
  async getGbpAccountIdsForUser(userId) {
    try {
      await this.initialize();

      let data;

      if (userId && !userId.includes('@')) {
        // userId is a firebase_uid
        const result = await this.client
          .from('users')
          .select('google_account_id')
          .eq('firebase_uid', userId)
          .maybeSingle();
        data = result.data;
      } else if (userId && userId.includes('@')) {
        // userId is an email
        const result = await this.client
          .from('users')
          .select('google_account_id')
          .ilike('gmail_id', userId)
          .maybeSingle();
        data = result.data;
      }

      if (data?.google_account_id) {
        return [data.google_account_id];
      }
      return [];
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
      paidSlots: subscription.paid_slots, // SLOT-BASED SUBSCRIPTION: Total paid slots
      paidLocationIds: subscription.paid_location_ids, // Track which locations are paid
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

      console.log('[SupabaseSubscriptionService] 🔄 UPDATE REQUEST:', {
        gbpAccountId,
        updates: {
          status: updates.status,
          paidSlots: updates.paidSlots,
          profileCount: updates.profileCount,
          planId: updates.planId
        }
      });

      // Map camelCase to snake_case
      const mappedUpdates = {
        updated_at: new Date().toISOString()
      };

      if (updates.status) mappedUpdates.status = updates.status;
      if (updates.planId) mappedUpdates.plan_id = updates.planId;
      if (updates.profileCount !== undefined) mappedUpdates.profile_count = updates.profileCount;
      if (updates.paidSlots !== undefined) mappedUpdates.paid_slots = updates.paidSlots; // CRITICAL: Paid slots mapping
      if (updates.paidLocationIds !== undefined) mappedUpdates.paid_location_ids = updates.paidLocationIds; // Track paid locations
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

      console.log('[SupabaseSubscriptionService] 📝 Mapped updates to DB:', mappedUpdates);

      // CRITICAL FIX: Find the correct subscription first (prefer active)
      // This handles duplicate subscriptions properly
      const { data: existingSubs, error: findError } = await this.client
        .from('subscriptions')
        .select('*')
        .eq('gbp_account_id', gbpAccountId)
        .order('status', { ascending: true }) // 'active' before 'expired'
        .order('updated_at', { ascending: false });

      if (findError) {
        console.error('[SupabaseSubscriptionService] ❌ FIND FAILED:', findError);
        throw findError;
      }

      if (!existingSubs || existingSubs.length === 0) {
        throw new Error(`No subscription found for gbpAccountId: ${gbpAccountId}`);
      }

      console.log(`[SupabaseSubscriptionService] Found ${existingSubs.length} subscription(s), updating the first (active) one`);

      // Update the first (active) subscription by ID
      const targetSub = existingSubs[0];
      const { data, error } = await this.client
        .from('subscriptions')
        .update(mappedUpdates)
        .eq('id', targetSub.id) // Update by ID to ensure we update the right one
        .select()
        .single();

      if (error) {
        console.error('[SupabaseSubscriptionService] ❌ UPDATE FAILED:', error);
        throw error;
      }

      console.log(`[SupabaseSubscriptionService] ✅ Updated subscription: ${gbpAccountId}`);
      console.log('[SupabaseSubscriptionService] 📊 Updated data:', {
        id: data.id,
        status: data.status,
        paid_slots: data.paid_slots,
        profile_count: data.profile_count,
        plan_id: data.plan_id
      });

      // CLEANUP: Delete duplicate subscriptions if any exist
      if (existingSubs.length > 1) {
        const duplicateIds = existingSubs.slice(1).map(s => s.id);
        console.log(`[SupabaseSubscriptionService] 🗑️ Cleaning up ${duplicateIds.length} duplicate subscription(s)`);

        const { error: deleteError } = await this.client
          .from('subscriptions')
          .delete()
          .in('id', duplicateIds);

        if (deleteError) {
          console.error('[SupabaseSubscriptionService] ⚠️ Failed to delete duplicates:', deleteError);
        } else {
          console.log('[SupabaseSubscriptionService] ✅ Duplicates removed');
        }
      }

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





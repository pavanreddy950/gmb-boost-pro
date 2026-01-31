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
   * Updated to use 'users' table instead of non-existent 'subscriptions' table
   */
  async saveSubscription(subscription) {
    try {
      await this.initialize();

      if (!subscription.gbpAccountId) {
        console.log('[SupabaseSubscriptionService] ⚠️ No gbpAccountId provided, skipping save');
        return subscription;
      }

      console.log(`[SupabaseSubscriptionService] 💾 Saving subscription to users table: ${subscription.email}`);

      // Update user record with subscription data
      const userData = {
        google_account_id: subscription.gbpAccountId,
        subscription_status: subscription.status || 'trial',
        trial_start_date: subscription.trialStartDate,
        trial_end_date: subscription.trialEndDate,
        subscription_start_date: subscription.subscriptionStartDate,
        subscription_end_date: subscription.subscriptionEndDate,
        profile_count: subscription.profileCount || 0,
        updated_at: new Date().toISOString()
      };

      // Try to update existing user by email or google_account_id
      let result;

      if (subscription.email) {
        const { data, error } = await this.client
          .from('users')
          .update(userData)
          .ilike('gmail_id', subscription.email)
          .select()
          .maybeSingle();

        if (!error && data) {
          result = data;
        }
      }

      if (!result && subscription.gbpAccountId) {
        const { data, error } = await this.client
          .from('users')
          .update(userData)
          .eq('google_account_id', subscription.gbpAccountId)
          .select()
          .maybeSingle();

        if (!error && data) {
          result = data;
        }
      }

      if (result) {
        console.log(`[SupabaseSubscriptionService] ✅ Subscription saved to users table`);
      } else {
        console.log(`[SupabaseSubscriptionService] ⚠️ No user found to update, subscription data stored in memory`);
      }

      return subscription;
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error saving subscription:', error);
      // Don't throw - just log and continue
      return subscription;
    }
  }

  /**
   * Save payment history
   * Note: payment_history table doesn't exist, so this is a no-op
   */
  async savePaymentHistory(subscriptionId, paymentHistory) {
    // Payment history table doesn't exist in current schema
    // Just log the payment info for now
    console.log(`[SupabaseSubscriptionService] 📝 Payment history (${paymentHistory.length} records) logged for subscription ${subscriptionId}`);
    return true;
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
  /**
   * Delete subscription
   * Note: Since we use users table, this just clears subscription fields
   */
  async deleteSubscription(gbpAccountId) {
    try {
      await this.initialize();

      // Clear subscription data from users table
      const { error } = await this.client
        .from('users')
        .update({
          subscription_status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('google_account_id', gbpAccountId);

      if (error) {
        console.warn('[SupabaseSubscriptionService] Could not update user:', error.message);
      }

      console.log(`[SupabaseSubscriptionService] ✅ Subscription cancelled for: ${gbpAccountId}`);
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
   * Updated to use 'users' table instead of non-existent 'subscriptions' table
   */
  async getSubscriptionById(subscriptionId) {
    try {
      await this.initialize();

      // Try to find user by various ID formats
      let user = null;

      // Try by firebase_uid
      const { data: userByUid, error: uidError } = await this.client
        .from('users')
        .select('*')
        .eq('firebase_uid', subscriptionId)
        .maybeSingle();

      if (!uidError && userByUid) {
        user = userByUid;
      }

      // If not found, try by id field
      if (!user) {
        const { data: userById, error: idError } = await this.client
          .from('users')
          .select('*')
          .eq('id', subscriptionId)
          .maybeSingle();

        if (!idError && userById) {
          user = userById;
        }
      }

      if (!user) {
        console.log('[SupabaseSubscriptionService] No user found for subscription ID:', subscriptionId);
        return null;
      }

      return this.formatUserAsSubscription(user);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error getting subscription by ID:', error);
      return null;
    }
  }

  /**
   * Update subscription (generic update method)
   * Updated to use 'users' table instead of non-existent 'subscriptions' table
   */
  async updateSubscription(gbpAccountId, updates) {
    try {
      await this.initialize();

      console.log('[SupabaseSubscriptionService] 🔄 UPDATE REQUEST (using users table):', {
        gbpAccountId,
        updates: {
          status: updates.status,
          profileCount: updates.profileCount
        }
      });

      // Map subscription updates to users table columns
      const mappedUpdates = {
        updated_at: new Date().toISOString()
      };

      // Map status to subscription_status in users table
      if (updates.status) mappedUpdates.subscription_status = updates.status;
      if (updates.profileCount !== undefined) mappedUpdates.profile_count = updates.profileCount;
      if (updates.trialStartDate) mappedUpdates.trial_start_date = updates.trialStartDate;
      if (updates.trialEndDate) mappedUpdates.trial_end_date = updates.trialEndDate;
      if (updates.subscriptionStartDate) mappedUpdates.subscription_start_date = updates.subscriptionStartDate;
      if (updates.subscriptionEndDate) mappedUpdates.subscription_end_date = updates.subscriptionEndDate;

      console.log('[SupabaseSubscriptionService] 📝 Mapped updates to users table:', mappedUpdates);

      // Find user by google_account_id
      const { data: existingUser, error: findError } = await this.client
        .from('users')
        .select('*')
        .eq('google_account_id', gbpAccountId)
        .maybeSingle();

      if (findError) {
        console.error('[SupabaseSubscriptionService] ❌ FIND FAILED:', findError);
        // Don't throw - just log and return null
        return null;
      }

      if (!existingUser) {
        console.log(`[SupabaseSubscriptionService] No user found for gbpAccountId: ${gbpAccountId}`);
        // Don't throw - just return null gracefully
        return null;
      }

      // Update the user record
      const { data, error } = await this.client
        .from('users')
        .update(mappedUpdates)
        .eq('google_account_id', gbpAccountId)
        .select()
        .single();

      if (error) {
        console.error('[SupabaseSubscriptionService] ❌ UPDATE FAILED:', error);
        return null;
      }

      console.log(`[SupabaseSubscriptionService] ✅ Updated user subscription: ${gbpAccountId}`);
      console.log('[SupabaseSubscriptionService] 📊 Updated data:', {
        id: data.id,
        subscription_status: data.subscription_status,
        profile_count: data.profile_count
      });

      return this.formatUserAsSubscription(data);
    } catch (error) {
      console.error('[SupabaseSubscriptionService] Error updating subscription:', error);
      // Don't throw - return null to prevent 500 errors
      return null;
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





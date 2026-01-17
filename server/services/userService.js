/**
 * User Service - Simple service based on gmail_id
 *
 * This service manages:
 * - User subscriptions (trial, active, expired, admin)
 * - User tokens (Google OAuth)
 * - User locations (business profiles)
 *
 * PRIMARY KEY: gmail_id (user's email address)
 *
 * Tables:
 * - users: Main user table with subscription and token info
 * - user_locations: Links users to their business locations
 */

import supabaseConfig from '../config/supabase.js';

class UserService {
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
      console.log('[UserService] ✅ Initialized with Supabase');
      return this.client;
    } catch (error) {
      console.error('[UserService] ❌ Initialization failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // USER CRUD OPERATIONS
  // ============================================================================

  /**
   * Get user by gmail_id (primary lookup method)
   * Note: Email lookup is case-insensitive for better matching
   */
  async getUserByEmail(email) {
    try {
      await this.initialize();

      if (!email) {
        console.warn('[UserService] getUserByEmail called with empty email');
        return null;
      }

      // Normalize email to lowercase for consistent matching
      const normalizedEmail = email.toLowerCase().trim();
      console.log(`[UserService] Looking up user by email: ${normalizedEmail}`);

      const { data, error } = await this.client
        .from('users')
        .select('*')
        .ilike('gmail_id', normalizedEmail)  // Case-insensitive match
        .maybeSingle();

      if (error) {
        console.error('[UserService] Error getting user by email:', error.message);
        return null;
      }

      if (data) {
        console.log(`[UserService] ✅ Found user: ${data.gmail_id}, status: ${data.subscription_status}`);
      } else {
        console.log(`[UserService] ⚠️ No user found for email: ${normalizedEmail}`);
      }

      return data;
    } catch (error) {
      console.error('[UserService] Error:', error);
      return null;
    }
  }

  /**
   * Get user by firebase_uid (alternative lookup)
   */
  async getUserByFirebaseUid(firebaseUid) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .maybeSingle();

      if (error) {
        console.error('[UserService] Error getting user by firebase_uid:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[UserService] Error:', error);
      return null;
    }
  }

  /**
   * Create or update user (upsert by gmail_id)
   */
  async upsertUser(userData) {
    try {
      await this.initialize();

      if (!userData.gmail_id) {
        throw new Error('gmail_id is required');
      }

      const { data, error } = await this.client
        .from('users')
        .upsert({
          gmail_id: userData.gmail_id,
          firebase_uid: userData.firebase_uid,
          display_name: userData.display_name,
          subscription_status: userData.subscription_status || 'trial',
          trial_start_date: userData.trial_start_date || new Date().toISOString(),
          trial_end_date: userData.trial_end_date,
          subscription_start_date: userData.subscription_start_date,
          subscription_end_date: userData.subscription_end_date,
          profile_count: userData.profile_count || 0,
          is_admin: userData.is_admin || false,
          google_access_token: userData.google_access_token,
          google_refresh_token: userData.google_refresh_token,
          google_token_expiry: userData.google_token_expiry,
          google_account_id: userData.google_account_id,
          has_valid_token: userData.has_valid_token || false,
          token_last_refreshed: userData.token_last_refreshed,
          token_error: userData.token_error,
          razorpay_order_id: userData.razorpay_order_id,
          razorpay_payment_id: userData.razorpay_payment_id,
          razorpay_subscription_id: userData.razorpay_subscription_id,
          amount_paid: userData.amount_paid || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'gmail_id' })
        .select()
        .single();

      if (error) {
        console.error('[UserService] Error upserting user:', error.message);
        throw error;
      }

      console.log(`[UserService] ✅ User upserted: ${userData.gmail_id}`);
      return data;
    } catch (error) {
      console.error('[UserService] Error:', error);
      throw error;
    }
  }

  /**
   * Update user by gmail_id
   */
  async updateUser(email, updates) {
    try {
      await this.initialize();

      console.log(`[UserService] Updating user ${email}:`, Object.keys(updates));

      const { data, error } = await this.client
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('gmail_id', email)
        .select()
        .single();

      if (error) {
        console.error('[UserService] Error updating user:', error.message);
        throw error;
      }

      console.log(`[UserService] ✅ User updated: ${email}`);
      return data;
    } catch (error) {
      console.error('[UserService] Error:', error);
      throw error;
    }
  }

  // ============================================================================
  // SUBSCRIPTION OPERATIONS
  // ============================================================================

  /**
   * Create trial subscription for new user
   */
  async createTrialSubscription(email, firebaseUid, displayName) {
    try {
      await this.initialize();

      // Check if user already exists
      const existing = await this.getUserByEmail(email);
      if (existing) {
        console.log(`[UserService] User already exists: ${email}, status: ${existing.subscription_status}`);
        return existing;
      }

      // Calculate trial end date (15 days from now)
      const now = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 15);

      const userData = {
        gmail_id: email,
        firebase_uid: firebaseUid,
        display_name: displayName,
        subscription_status: 'trial',
        trial_start_date: now.toISOString(),
        trial_end_date: trialEnd.toISOString(),
        profile_count: 0,
        is_admin: email === 'scalepointstrategy@gmail.com'
      };

      const user = await this.upsertUser(userData);
      console.log(`[UserService] ✅ Trial created for: ${email}, ends: ${trialEnd.toISOString()}`);
      return user;
    } catch (error) {
      console.error('[UserService] Error creating trial:', error);
      throw error;
    }
  }

  /**
   * Activate subscription after payment
   */
  async activateSubscription(email, paymentDetails) {
    try {
      await this.initialize();

      const now = new Date();
      const subscriptionEnd = new Date();
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1); // 1 year subscription

      const updates = {
        subscription_status: 'active',
        subscription_start_date: now.toISOString(),
        subscription_end_date: subscriptionEnd.toISOString(),
        profile_count: paymentDetails.profileCount || 1,
        razorpay_order_id: paymentDetails.razorpayOrderId,
        razorpay_payment_id: paymentDetails.razorpayPaymentId,
        razorpay_subscription_id: paymentDetails.razorpaySubscriptionId,
        amount_paid: paymentDetails.amount || 0
      };

      const user = await this.updateUser(email, updates);
      console.log(`[UserService] ✅ Subscription activated for: ${email}, profiles: ${updates.profile_count}`);
      return user;
    } catch (error) {
      console.error('[UserService] Error activating subscription:', error);
      throw error;
    }
  }

  /**
   * Check subscription status
   */
  async checkSubscriptionStatus(email) {
    try {
      await this.initialize();

      console.log(`[UserService] checkSubscriptionStatus called for: ${email}`);

      const user = await this.getUserByEmail(email);

      if (!user) {
        console.log(`[UserService] ⚠️ checkSubscriptionStatus: No user found for ${email}`);
        return {
          status: 'none',
          isValid: false,
          canUsePlatform: true, // Allow signup
          message: 'No user found'
        };
      }

      // 🔧 FIX: Trim subscription_status to handle any whitespace issues in database
      const subscriptionStatus = (user.subscription_status || '').trim();
      console.log(`[UserService] checkSubscriptionStatus: Found user with status: "${subscriptionStatus}" (raw: "${user.subscription_status}"), profile_count: ${user.profile_count}`);

      // Admin bypass
      if (user.is_admin || subscriptionStatus === 'admin') {
        return {
          status: 'admin',
          isValid: true,
          canUsePlatform: true,
          daysRemaining: 999999,
          profileCount: user.profile_count,
          message: 'Admin - Unlimited access'
        };
      }

      const now = new Date();

      // Check active subscription
      if (subscriptionStatus === 'active') {
        const endDate = new Date(user.subscription_end_date);
        if (endDate > now) {
          const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
          return {
            status: 'active',
            isValid: true,
            canUsePlatform: true,
            daysRemaining,
            profileCount: user.profile_count,
            subscriptionEndDate: user.subscription_end_date,
            message: `Subscription active - ${daysRemaining} days remaining`
          };
        } else {
          // Subscription expired - update status
          await this.updateUser(email, { subscription_status: 'expired' });
          return {
            status: 'expired',
            isValid: false,
            canUsePlatform: false,
            requiresPayment: true,
            message: 'Subscription expired. Please renew.'
          };
        }
      }

      // Check trial
      if (subscriptionStatus === 'trial') {
        const trialEnd = new Date(user.trial_end_date);
        if (trialEnd > now) {
          const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
          return {
            status: 'trial',
            isValid: true,
            canUsePlatform: true,
            daysRemaining,
            trialEndDate: user.trial_end_date,
            message: `Trial active - ${daysRemaining} days remaining`
          };
        } else {
          // Trial expired - update status
          await this.updateUser(email, { subscription_status: 'expired' });
          return {
            status: 'expired',
            isValid: false,
            canUsePlatform: false,
            requiresPayment: true,
            billingOnly: true,
            message: 'Trial expired. Please upgrade.'
          };
        }
      }

      // Expired or other status
      return {
        status: subscriptionStatus, // Use trimmed value
        isValid: false,
        canUsePlatform: false,
        requiresPayment: true,
        message: 'Please subscribe to continue.'
      };
    } catch (error) {
      console.error('[UserService] Error checking subscription:', error);
      return {
        status: 'error',
        isValid: false,
        message: 'Error checking subscription'
      };
    }
  }

  // ============================================================================
  // TOKEN OPERATIONS
  // ============================================================================

  /**
   * Save Google tokens for user
   */
  async saveTokens(email, tokens) {
    try {
      await this.initialize();

      const updates = {
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expiry: tokens.expiry_date,
        google_account_id: tokens.account_id,
        has_valid_token: true,
        token_last_refreshed: new Date().toISOString(),
        token_error: null
      };

      const user = await this.updateUser(email, updates);
      console.log(`[UserService] ✅ Tokens saved for: ${email}`);
      return user;
    } catch (error) {
      console.error('[UserService] Error saving tokens:', error);
      throw error;
    }
  }

  /**
   * Get tokens for user
   */
  async getTokens(email) {
    try {
      const user = await this.getUserByEmail(email);
      if (!user || !user.google_access_token) {
        return null;
      }

      return {
        access_token: user.google_access_token,
        refresh_token: user.google_refresh_token,
        expiry_date: user.google_token_expiry,
        account_id: user.google_account_id
      };
    } catch (error) {
      console.error('[UserService] Error getting tokens:', error);
      return null;
    }
  }

  /**
   * Mark tokens as invalid
   */
  async invalidateTokens(email, errorMessage) {
    try {
      await this.updateUser(email, {
        has_valid_token: false,
        token_error: errorMessage
      });
      console.log(`[UserService] ⚠️ Tokens invalidated for: ${email}`);
    } catch (error) {
      console.error('[UserService] Error invalidating tokens:', error);
    }
  }

  // ============================================================================
  // LOCATION OPERATIONS
  // ============================================================================

  /**
   * Get all locations for user
   */
  async getUserLocations(email) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_locations')
        .select('*')
        .eq('gmail_id', email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[UserService] Error getting locations:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[UserService] Error:', error);
      return [];
    }
  }

  /**
   * Add or update location for user
   */
  async upsertLocation(email, locationData) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_locations')
        .upsert({
          gmail_id: email,
          location_id: locationData.location_id,
          business_name: locationData.business_name,
          address: locationData.address,
          category: locationData.category,
          keywords: locationData.keywords,
          autoposting_enabled: locationData.autoposting_enabled || false,
          autoposting_schedule: locationData.autoposting_schedule || '10:00',
          autoposting_frequency: locationData.autoposting_frequency || 'daily',
          autoposting_timezone: locationData.autoposting_timezone || 'Asia/Kolkata',
          autoposting_status: locationData.autoposting_status || 'disabled',
          autoposting_status_reason: locationData.autoposting_status_reason,
          autoreply_enabled: locationData.autoreply_enabled || false,
          autoreply_status: locationData.autoreply_status || 'disabled',
          autoreply_status_reason: locationData.autoreply_status_reason,
          updated_at: new Date().toISOString()
        }, { onConflict: 'gmail_id,location_id' })
        .select()
        .single();

      if (error) {
        console.error('[UserService] Error upserting location:', error.message);
        throw error;
      }

      console.log(`[UserService] ✅ Location upserted: ${locationData.business_name}`);
      return data;
    } catch (error) {
      console.error('[UserService] Error:', error);
      throw error;
    }
  }

  /**
   * Update location settings
   */
  async updateLocation(email, locationId, updates) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_locations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('gmail_id', email)
        .eq('location_id', locationId)
        .select()
        .single();

      if (error) {
        console.error('[UserService] Error updating location:', error.message);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[UserService] Error:', error);
      throw error;
    }
  }

  /**
   * Delete location
   */
  async deleteLocation(email, locationId) {
    try {
      await this.initialize();

      const { error } = await this.client
        .from('user_locations')
        .delete()
        .eq('gmail_id', email)
        .eq('location_id', locationId);

      if (error) {
        console.error('[UserService] Error deleting location:', error.message);
        throw error;
      }

      console.log(`[UserService] ✅ Location deleted: ${locationId}`);
      return true;
    } catch (error) {
      console.error('[UserService] Error:', error);
      throw error;
    }
  }

  // ============================================================================
  // AUTOMATION HELPERS
  // ============================================================================

  /**
   * Get all locations with autoposting enabled
   */
  async getAutopostingLocations() {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_locations')
        .select(`
          *,
          users!inner (
            gmail_id,
            subscription_status,
            trial_end_date,
            subscription_end_date,
            has_valid_token,
            google_access_token,
            google_refresh_token,
            google_token_expiry,
            is_admin
          )
        `)
        .eq('autoposting_enabled', true)
        .eq('autoposting_status', 'active');

      if (error) {
        console.error('[UserService] Error getting autoposting locations:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[UserService] Error:', error);
      return [];
    }
  }

  /**
   * Update autoposting status for location
   */
  async updateAutopostingStatus(email, locationId, status, reason) {
    try {
      return await this.updateLocation(email, locationId, {
        autoposting_status: status,
        autoposting_status_reason: reason
      });
    } catch (error) {
      console.error('[UserService] Error updating autoposting status:', error);
      throw error;
    }
  }

  /**
   * Record successful post
   */
  async recordPostSuccess(email, locationId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_locations')
        .update({
          last_post_date: new Date().toISOString(),
          last_post_success: true,
          last_post_error: null,
          total_posts_created: this.client.rpc('increment', { x: 1 }),
          updated_at: new Date().toISOString()
        })
        .eq('gmail_id', email)
        .eq('location_id', locationId)
        .select()
        .single();

      // If RPC doesn't work, do manual increment
      if (error && error.message.includes('increment')) {
        const location = await this.getLocation(email, locationId);
        if (location) {
          return await this.updateLocation(email, locationId, {
            last_post_date: new Date().toISOString(),
            last_post_success: true,
            last_post_error: null,
            total_posts_created: (location.total_posts_created || 0) + 1
          });
        }
      }

      return data;
    } catch (error) {
      console.error('[UserService] Error recording post success:', error);
    }
  }

  /**
   * Record failed post
   */
  async recordPostFailure(email, locationId, errorMessage) {
    try {
      return await this.updateLocation(email, locationId, {
        last_post_date: new Date().toISOString(),
        last_post_success: false,
        last_post_error: errorMessage
      });
    } catch (error) {
      console.error('[UserService] Error recording post failure:', error);
    }
  }

  /**
   * Get location by email and locationId
   */
  async getLocation(email, locationId) {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('user_locations')
        .select('*')
        .eq('gmail_id', email)
        .eq('location_id', locationId)
        .maybeSingle();

      if (error) {
        console.error('[UserService] Error getting location:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[UserService] Error:', error);
      return null;
    }
  }

  // ============================================================================
  // ADMIN OPERATIONS
  // ============================================================================

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    try {
      await this.initialize();

      const { data, error } = await this.client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[UserService] Error getting all users:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[UserService] Error:', error);
      return [];
    }
  }

  /**
   * Check if user is admin
   */
  async isAdmin(email) {
    try {
      const user = await this.getUserByEmail(email);
      return user?.is_admin === true || user?.subscription_status === 'admin';
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
const userService = new UserService();

export default userService;

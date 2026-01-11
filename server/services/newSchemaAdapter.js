import { createClient } from '@supabase/supabase-js';

/**
 * NEW SCHEMA ADAPTER
 *
 * This adapter automatically syncs data to the new clean schema
 * when the old services try to write data.
 *
 * NEW SCHEMA:
 * - users (gmail_id, firebase_uid, subscription info, tokens)
 * - user_locations (gmail_id, location_id, automation settings)
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class NewSchemaAdapter {
  /**
   * Create or update user in new schema
   * Called when user logs in or connects Google
   */
  async upsertUser(data) {
    try {
      const {
        gmailId,           // REQUIRED
        firebaseUid,
        displayName,
        subscriptionStatus = 'trial',
        trialEndDate,
        googleAccessToken,
        googleRefreshToken,
        googleTokenExpiry,
        googleAccountId
      } = data;

      if (!gmailId) {
        console.error('[NewSchemaAdapter] ❌ Gmail ID is required');
        return null;
      }

      // Calculate trial end date if not provided (15 days from now)
      const calculatedTrialEndDate = trialEndDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

      const userData = {
        gmail_id: gmailId,
        firebase_uid: firebaseUid,
        display_name: displayName,
        subscription_status: subscriptionStatus,
        trial_start_date: new Date().toISOString(),
        trial_end_date: calculatedTrialEndDate,
        google_access_token: googleAccessToken,
        google_refresh_token: googleRefreshToken,
        google_token_expiry: googleTokenExpiry,
        google_account_id: googleAccountId,
        has_valid_token: !!(googleAccessToken && googleRefreshToken),
        token_last_refreshed: googleAccessToken ? new Date().toISOString() : null,
        is_admin: gmailId === 'scalepointstrategy@gmail.com',
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'gmail_id' })
        .select()
        .single();

      if (error) {
        console.error('[NewSchemaAdapter] ❌ Error upserting user:', error);
        return null;
      }

      console.log(`[NewSchemaAdapter] ✅ User upserted: ${gmailId}`);
      return result;
    } catch (error) {
      console.error('[NewSchemaAdapter] ❌ Exception in upsertUser:', error);
      return null;
    }
  }

  /**
   * Create or update location in new schema
   */
  async upsertLocation(data) {
    try {
      const {
        gmailId,          // REQUIRED
        locationId,       // REQUIRED
        businessName,
        address,
        category = 'business',
        keywords,
        autopostingEnabled = false,
        autopostingSchedule = '10:00',
        autopostingFrequency = 'daily',
        autoreplyEnabled = true  // Enable auto-reply by default
      } = data;

      if (!gmailId || !locationId) {
        console.error('[NewSchemaAdapter] ❌ Gmail ID and Location ID are required');
        return null;
      }

      // Determine autoposting status based on user's subscription
      const { data: user } = await supabase
        .from('users')
        .select('subscription_status, trial_end_date, subscription_end_date, has_valid_token, is_admin')
        .eq('gmail_id', gmailId)
        .single();

      let autopostingStatus = 'disabled';
      let autopostingStatusReason = 'User has not enabled auto-posting';

      if (autopostingEnabled) {
        if (user?.is_admin) {
          autopostingStatus = 'active';
          autopostingStatusReason = 'Admin user - unlimited access';
        } else if (!user?.has_valid_token) {
          autopostingStatus = 'blocked_no_token';
          autopostingStatusReason = 'No valid Google token available';
        } else if (user?.subscription_status === 'trial') {
          const trialEnd = new Date(user.trial_end_date);
          if (trialEnd > new Date()) {
            autopostingStatus = 'active';
            const daysLeft = Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24));
            autopostingStatusReason = `Trial active - ${daysLeft} days remaining`;
          } else {
            autopostingStatus = 'blocked_expired_trial';
            autopostingStatusReason = `Trial expired on ${trialEnd.toISOString().split('T')[0]}`;
          }
        } else if (user?.subscription_status === 'active') {
          const subEnd = new Date(user.subscription_end_date);
          if (subEnd > new Date()) {
            autopostingStatus = 'active';
            const daysLeft = Math.ceil((subEnd - new Date()) / (1000 * 60 * 60 * 24));
            autopostingStatusReason = `Subscription active - ${daysLeft} days remaining`;
          } else {
            autopostingStatus = 'blocked_expired_subscription';
            autopostingStatusReason = `Subscription expired on ${subEnd.toISOString().split('T')[0]}`;
          }
        } else {
          autopostingStatus = 'blocked_no_subscription';
          autopostingStatusReason = 'No active trial or subscription';
        }
      }

      const locationData = {
        gmail_id: gmailId,
        location_id: locationId,
        business_name: businessName,
        address: address,
        category: category,
        keywords: keywords || businessName,
        autoposting_enabled: autopostingEnabled,
        autoposting_schedule: autopostingSchedule,
        autoposting_frequency: autopostingFrequency,
        autoposting_status: autopostingStatus,
        autoposting_status_reason: autopostingStatusReason,
        autoreply_enabled: autoreplyEnabled,
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await supabase
        .from('user_locations')
        .upsert(locationData, { onConflict: 'gmail_id,location_id' })
        .select()
        .single();

      if (error) {
        console.error('[NewSchemaAdapter] ❌ Error upserting location:', error);
        return null;
      }

      console.log(`[NewSchemaAdapter] ✅ Location upserted: ${businessName} (${locationId})`);
      return result;
    } catch (error) {
      console.error('[NewSchemaAdapter] ❌ Exception in upsertLocation:', error);
      return null;
    }
  }

  /**
   * Get user by Gmail ID
   */
  async getUserByGmail(gmailId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('gmail_id', gmailId)
        .single();

      if (error) {
        console.log(`[NewSchemaAdapter] User not found: ${gmailId}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[NewSchemaAdapter] ❌ Error getting user:', error);
      return null;
    }
  }

  /**
   * Get user by Firebase UID
   */
  async getUserByFirebaseUid(firebaseUid) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .single();

      if (error) {
        console.log(`[NewSchemaAdapter] User not found by UID: ${firebaseUid}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[NewSchemaAdapter] ❌ Error getting user by UID:', error);
      return null;
    }
  }

  /**
   * Get all locations for a user
   */
  async getUserLocations(gmailId) {
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .eq('gmail_id', gmailId);

      if (error) {
        console.error('[NewSchemaAdapter] ❌ Error getting locations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[NewSchemaAdapter] ❌ Exception in getUserLocations:', error);
      return [];
    }
  }

  /**
   * Get location by location_id
   */
  async getLocation(locationId) {
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .eq('location_id', locationId)
        .single();

      if (error) {
        console.log(`[NewSchemaAdapter] Location not found: ${locationId}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[NewSchemaAdapter] ❌ Error getting location:', error);
      return null;
    }
  }
}

// Export singleton
const newSchemaAdapter = new NewSchemaAdapter();
export default newSchemaAdapter;

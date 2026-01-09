import supabaseSubscriptionService from './supabaseSubscriptionService.js';
import supabaseAutomationService from './supabaseAutomationService.js';
import userService from './userService.js';
// import admin from 'firebase-admin'; // DISABLED for Node.js v25 compatibility

/**
 * Subscription Guard Service
 * Enforces feature access based on subscription/trial status
 * Automatically disables features when trial/subscription expires
 * ADMINS BYPASS ALL CHECKS
 */
class SubscriptionGuard {
  constructor() {
    this.checkInterval = null;
    console.log('[SubscriptionGuard] Initializing subscription enforcement system...');
  }

  /**
   * Check if user is admin (bypasses subscription checks)
   * Checks against hardcoded admin email whitelist
   * IMPROVED: Checks multiple sources for email to ensure admin is always detected
   */
  async isAdmin(userId) {
    try {
      // Admin email whitelist
      const adminEmails = [
        'scalepointstrategy@gmail.com'
      ];

      // Also check if userId itself is an admin email (sometimes userId IS the email)
      if (adminEmails.includes(userId)) {
        console.log(`[SubscriptionGuard] ✅ Admin detected (userId is email): ${userId}`);
        return true;
      }

      // Try multiple sources to find the user's email
      let userEmail = null;

      // Source 1: Try subscription by userId
      const subscription = await supabaseSubscriptionService.getSubscriptionByUserId(userId);
      if (subscription?.email) {
        userEmail = subscription.email;
      }

      // Source 2: Try subscription by email (if userId looks like email)
      if (!userEmail && userId && userId.includes('@')) {
        const subByEmail = await supabaseSubscriptionService.getSubscriptionByEmail(userId);
        if (subByEmail?.email) {
          userEmail = subByEmail.email;
        }
      }

      // Source 3: Check automation settings for email
      if (!userEmail) {
        const automationSettings = await supabaseAutomationService.getAllSettingsForUser(userId);
        if (automationSettings.length > 0) {
          // Check if any setting has email info
          for (const setting of automationSettings) {
            if (setting.email) {
              userEmail = setting.email;
              break;
            }
            // Also check nested settings
            if (setting.autoPosting?.email) {
              userEmail = setting.autoPosting.email;
              break;
            }
          }
        }
      }

      if (!userEmail) {
        console.log('[SubscriptionGuard] ⚠️ Could not find email for userId:', userId);
        return false;
      }

      const isAdminUser = adminEmails.includes(userEmail.toLowerCase());
      if (isAdminUser) {
        console.log(`[SubscriptionGuard] ✅ Admin detected: ${userEmail}`);
      }
      return isAdminUser;
    } catch (error) {
      console.error('[SubscriptionGuard] Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Check if user has valid access (trial or active subscription)
   * ADMINS ALWAYS HAVE ACCESS
   */
  async hasValidAccess(userId, gbpAccountId) {
    try {
      // 🔓 ADMIN CHECK - Admins bypass all subscription checks
      if (userId) {
        const isAdminUser = await this.isAdmin(userId);
        if (isAdminUser) {
          return {
            hasAccess: true,
            status: 'admin',
            daysRemaining: 999999,
            subscription: null,
            message: 'Admin access - unlimited'
          };
        }
      }

      // ========================================
      // NEW: Check users table first (simplified schema)
      // ========================================
      let userFromUsersTable = null;

      // Strategy 0: Check users table by email (if userId looks like an email)
      if (userId && userId.includes('@')) {
        console.log(`[SubscriptionGuard] 🔄 Checking users table by email: ${userId}`);
        const userStatus = await userService.checkSubscriptionStatus(userId);
        if (userStatus && userStatus.status !== 'none') {
          console.log(`[SubscriptionGuard] ✅ Found user in users table: ${userId}, status: ${userStatus.status}`);

          // Return the result from userService
          if (userStatus.status === 'admin') {
            return {
              hasAccess: true,
              status: 'admin',
              daysRemaining: 999999,
              subscription: null,
              message: 'Admin access - unlimited'
            };
          }

          if (userStatus.status === 'active' || userStatus.status === 'trial') {
            return {
              hasAccess: true,
              status: userStatus.status,
              daysRemaining: userStatus.daysRemaining || 0,
              subscription: {
                status: userStatus.status,
                profileCount: userStatus.profileCount,
                subscriptionEndDate: userStatus.subscriptionEndDate,
                trialEndDate: userStatus.trialEndDate
              },
              message: userStatus.message
            };
          }

          // Expired
          if (userStatus.status === 'expired') {
            return {
              hasAccess: false,
              reason: 'expired',
              status: 'expired',
              message: userStatus.message,
              requiresPayment: true
            };
          }
        }
      }

      // Strategy 0b: Check users table by firebase_uid
      if (userId && !userId.includes('@')) {
        console.log(`[SubscriptionGuard] 🔄 Checking users table by firebase_uid: ${userId}`);
        const user = await userService.getUserByFirebaseUid(userId);
        if (user) {
          console.log(`[SubscriptionGuard] ✅ Found user by firebase_uid: ${user.gmail_id}`);
          const userStatus = await userService.checkSubscriptionStatus(user.gmail_id);

          if (userStatus && userStatus.status !== 'none') {
            if (userStatus.status === 'admin') {
              return {
                hasAccess: true,
                status: 'admin',
                daysRemaining: 999999,
                subscription: null,
                message: 'Admin access - unlimited'
              };
            }

            if (userStatus.status === 'active' || userStatus.status === 'trial') {
              return {
                hasAccess: true,
                status: userStatus.status,
                daysRemaining: userStatus.daysRemaining || 0,
                subscription: {
                  status: userStatus.status,
                  profileCount: userStatus.profileCount,
                  subscriptionEndDate: userStatus.subscriptionEndDate,
                  trialEndDate: userStatus.trialEndDate
                },
                message: userStatus.message
              };
            }

            if (userStatus.status === 'expired') {
              return {
                hasAccess: false,
                reason: 'expired',
                status: 'expired',
                message: userStatus.message,
                requiresPayment: true
              };
            }
          }
        }
      }

      // ========================================
      // FALLBACK: Check old subscriptions table (for backward compatibility)
      // ========================================
      let subscription = null;

      // Strategy 1: Try by GBP account ID
      if (gbpAccountId) {
        subscription = await supabaseSubscriptionService.getSubscriptionByGbpId(gbpAccountId);
        if (subscription) {
          console.log(`[SubscriptionGuard] ✅ Found subscription by gbpAccountId: ${gbpAccountId}`);
        }
      }

      // Strategy 2: Try by userId
      if (!subscription && userId) {
        console.log(`[SubscriptionGuard] 🔄 No subscription found by GBP ID, trying userId: ${userId}`);
        subscription = await supabaseSubscriptionService.getSubscriptionByUserId(userId);
        if (subscription) {
          console.log(`[SubscriptionGuard] ✅ Found subscription by userId: ${userId}`);
        }
      }

      // Strategy 3: Try by email (if userId looks like an email)
      if (!subscription && userId && userId.includes('@')) {
        console.log(`[SubscriptionGuard] 🔄 Trying email lookup: ${userId}`);
        subscription = await supabaseSubscriptionService.getSubscriptionByEmail(userId);
        if (subscription) {
          console.log(`[SubscriptionGuard] ✅ Found subscription by email: ${userId}`);
        }
      }

      // Strategy 4: Get email from automation settings and try lookup
      if (!subscription && userId) {
        try {
          const automationSettings = await supabaseAutomationService.getAllSettingsForUser(userId);
          for (const setting of automationSettings) {
            const email = setting.email || setting.autoPosting?.email;
            if (email) {
              console.log(`[SubscriptionGuard] 🔄 Trying email from automation settings: ${email}`);
              subscription = await supabaseSubscriptionService.getSubscriptionByEmail(email);
              if (subscription) {
                console.log(`[SubscriptionGuard] ✅ Found subscription by automation email: ${email}`);
                break;
              }
            }
          }
        } catch (err) {
          console.log(`[SubscriptionGuard] ⚠️ Could not check automation settings for email:`, err.message);
        }
      }

      if (!subscription) {
        console.log(`[SubscriptionGuard] ❌ No subscription found after all lookup strategies`);
        console.log(`[SubscriptionGuard]    Tried: gbpAccountId=${gbpAccountId}, userId=${userId}`);

        return {
          hasAccess: false,
          reason: 'no_subscription',
          message: 'No subscription found. Please start a free trial.',
          requiresPayment: true
        };
      }

      console.log(`[SubscriptionGuard] ✅ Found subscription for user ${userId}:`, {
        status: subscription.status,
        gbpAccountId: subscription.gbpAccountId,
        daysRemaining: subscription.subscriptionEndDate ? Math.ceil((new Date(subscription.subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24)) : 'N/A'
      });

      const now = new Date();

      // Check if active subscription
      if (subscription.status === 'active') {
        const endDate = subscription.subscriptionEndDate ? new Date(subscription.subscriptionEndDate) : null;

        // CRITICAL FIX: If subscription is 'active' and has NO end date, it's a valid paid subscription
        // This happens when user pays through Razorpay and subscription is ongoing
        if (!endDate) {
          console.log(`[SubscriptionGuard] ✅ Active subscription with no end date - treating as valid paid subscription`);
          return {
            hasAccess: true,
            status: 'active',
            daysRemaining: 999999, // Unlimited until manually cancelled
            subscription,
            message: 'Active paid subscription'
          };
        }

        if (endDate > now) {
          const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
          return {
            hasAccess: true,
            status: 'active',
            daysRemaining,
            subscription,
            message: `Subscription active - ${daysRemaining} days remaining`
          };
        } else {
          // Subscription expired - disable features
          await this.disableAllFeatures(userId, gbpAccountId, 'subscription_expired');

          return {
            hasAccess: false,
            reason: 'subscription_expired',
            message: 'Your subscription has expired. Please renew to continue.',
            requiresPayment: true,
            subscription
          };
        }
      }

      // Check if in trial period
      if (subscription.status === 'trial') {
        const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;

        // CRITICAL FIX: If trial has no end date, treat as active trial (15 days from creation)
        if (!trialEndDate) {
          console.log(`[SubscriptionGuard] ✅ Trial with no end date - treating as active trial`);
          return {
            hasAccess: true,
            status: 'trial',
            daysRemaining: 15, // Default trial period
            subscription,
            message: 'Free trial active'
          };
        }

        if (trialEndDate > now) {
          const daysRemaining = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
          return {
            hasAccess: true,
            status: 'trial',
            daysRemaining,
            subscription,
            message: `Free trial - ${daysRemaining} days remaining`
          };
        } else {
          // Trial expired - disable features
          await this.disableAllFeatures(userId, gbpAccountId, 'trial_expired');

          return {
            hasAccess: false,
            reason: 'trial_expired',
            message: 'Your free trial has ended. Upgrade to continue using all features.',
            requiresPayment: true,
            subscription
          };
        }
      }

      // Invalid status
      return {
        hasAccess: false,
        reason: 'invalid_status',
        message: 'Subscription status invalid. Please contact support.',
        requiresPayment: true,
        subscription
      };

    } catch (error) {
      console.error('[SubscriptionGuard] Error checking access:', error);
      return {
        hasAccess: false,
        reason: 'error',
        message: 'Unable to verify subscription status',
        requiresPayment: false
      };
    }
  }

  /**
   * Disable all automation features for a user
   */
  async disableAllFeatures(userId, gbpAccountId, reason) {
    try {
      console.log(`[SubscriptionGuard] 🔒 Disabling all features for user ${userId} - Reason: ${reason}`);

      // Get all automation settings for this user
      const settings = await supabaseAutomationService.getAllSettingsForUser(userId);

      // Disable each automation
      for (const setting of settings) {
        // Use locationId (camelCase) as returned by formatSettings, not location_id
        const locationId = setting.locationId || setting.location_id;

        // Skip if no valid locationId
        if (!locationId) {
          console.warn(`[SubscriptionGuard] ⚠️ Skipping setting without valid locationId for user: ${userId}`);
          continue;
        }

        await supabaseAutomationService.saveSettings(userId, locationId, {
          ...setting,
          enabled: false,
          autoPosting: {
            ...setting.autoPosting,
            enabled: false
          },
          autoReply: {
            ...setting.autoReply,
            enabled: false
          },
          autoReplyEnabled: false,
          disabledReason: reason,
          disabledAt: new Date().toISOString()
        });

        console.log(`[SubscriptionGuard] ✅ Disabled automation for location: ${locationId}`);
      }

      // Log this action
      await supabaseAutomationService.logActivity(
        userId,
        'system',
        'features_disabled',
        null,
        'success',
        {
          reason,
          locationsAffected: settings.length,
          timestamp: new Date().toISOString()
        }
      );

      console.log(`[SubscriptionGuard] ✅ All features disabled for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[SubscriptionGuard] Error disabling features:', error);
      return false;
    }
  }

  /**
   * Re-enable all automation features for a user
   * Called when subscription/payment is renewed or trial starts
   */
  async reEnableAllFeatures(userId, gbpAccountId, reason) {
    try {
      console.log(`[SubscriptionGuard] 🔓 Re-enabling features for user ${userId} - Reason: ${reason}`);

      // Get all automation settings for this user (including disabled ones)
      const settings = await supabaseAutomationService.getAllSettingsForUser(userId);

      let reenabledCount = 0;

      for (const setting of settings) {
        const locationId = setting.locationId || setting.location_id;

        if (!locationId) {
          console.warn(`[SubscriptionGuard] ⚠️ Skipping setting without valid locationId for user: ${userId}`);
          continue;
        }

        // Only re-enable if it was disabled due to subscription/trial issues
        const disabledReason = setting.disabledReason;
        if (disabledReason && (
          disabledReason.includes('expired') ||
          disabledReason.includes('subscription') ||
          disabledReason.includes('trial')
        )) {
          await supabaseAutomationService.saveSettings(userId, locationId, {
            ...setting,
            enabled: true,
            autoPosting: {
              ...setting.autoPosting,
              enabled: true
            },
            // Keep autoReply at user's previous preference
            disabledReason: null,
            disabledAt: null,
            reenabledReason: reason,
            reenabledAt: new Date().toISOString()
          });

          console.log(`[SubscriptionGuard] ✅ Re-enabled automation for location: ${locationId}`);
          reenabledCount++;
        }
      }

      // Log this action
      await supabaseAutomationService.logActivity(
        userId,
        'system',
        'features_reenabled',
        null,
        'success',
        {
          reason,
          locationsAffected: reenabledCount,
          timestamp: new Date().toISOString()
        }
      );

      console.log(`[SubscriptionGuard] ✅ Re-enabled ${reenabledCount} location(s) for user ${userId}`);
      return { success: true, reenabledCount };
    } catch (error) {
      console.error('[SubscriptionGuard] Error re-enabling features:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a specific feature is allowed
   */
  async canUseFeature(userId, gbpAccountId, featureName) {
    const access = await this.hasValidAccess(userId, gbpAccountId);

    if (!access.hasAccess) {
      console.log(`[SubscriptionGuard] ❌ Feature "${featureName}" blocked for user ${userId} - ${access.reason}`);
      return {
        allowed: false,
        reason: access.reason,
        message: access.message,
        requiresPayment: access.requiresPayment
      };
    }

    console.log(`[SubscriptionGuard] ✅ Feature "${featureName}" allowed for user ${userId}`);
    return {
      allowed: true,
      status: access.status,
      daysRemaining: access.daysRemaining
    };
  }

  /**
   * Start periodic subscription checks (runs every hour)
   */
  startPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log('[SubscriptionGuard] ⏰ Starting periodic subscription checks (every hour)');

    // Check all subscriptions every hour
    this.checkInterval = setInterval(async () => {
      console.log('[SubscriptionGuard] 🔍 Running periodic subscription check...');
      await this.checkAllSubscriptions();
    }, 60 * 60 * 1000); // 1 hour

    // Run initial check
    this.checkAllSubscriptions();
  }

  /**
   * Check all subscriptions and disable expired ones
   */
  async checkAllSubscriptions() {
    try {
      const subscriptions = await supabaseSubscriptionService.getAllSubscriptions();
      console.log(`[SubscriptionGuard] Checking ${subscriptions.length} subscriptions...`);

      const now = new Date();
      let expiredCount = 0;

      for (const subscription of subscriptions) {
        const userId = subscription.userId;
        const gbpAccountId = subscription.gbpAccountId;

        // Check if trial expired
        if (subscription.status === 'trial' && subscription.trialEndDate) {
          const trialEndDate = new Date(subscription.trialEndDate);
          if (trialEndDate <= now) {
            console.log(`[SubscriptionGuard] ⚠️ Trial expired for user ${userId}`);
            await this.disableAllFeatures(userId, gbpAccountId, 'trial_expired');
            await supabaseSubscriptionService.updateSubscriptionStatus(gbpAccountId, 'expired');
            expiredCount++;
          }
        }

        // Check if subscription expired
        if (subscription.status === 'active' && subscription.subscriptionEndDate) {
          const endDate = new Date(subscription.subscriptionEndDate);
          if (endDate <= now) {
            console.log(`[SubscriptionGuard] ⚠️ Subscription expired for user ${userId}`);
            await this.disableAllFeatures(userId, gbpAccountId, 'subscription_expired');
            await supabaseSubscriptionService.updateSubscriptionStatus(gbpAccountId, 'expired');
            expiredCount++;
          }
        }
      }

      console.log(`[SubscriptionGuard] ✅ Subscription check complete - ${expiredCount} expired`);
    } catch (error) {
      console.error('[SubscriptionGuard] Error checking subscriptions:', error);
    }
  }

  /**
   * Stop periodic checks
   */
  stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[SubscriptionGuard] ✅ Periodic checks stopped');
    }
  }

  /**
   * Validate before running automation
   * Enforces subscription/trial requirements for all automation types
   * - Admin accounts: Always allowed (unlimited)
   * - Users in trial: Allowed until trial expires
   * - Users with active subscription: Allowed until subscription expires
   * - Users with no trial/subscription: Blocked
   */
  async validateBeforeAutomation(userId, gbpAccountId, automationType) {
    console.log(`[SubscriptionGuard] 🔍 Validating ${automationType} for user ${userId}, gbpAccountId: ${gbpAccountId}`);

    // Check subscription/trial status for all automation types
    const access = await this.hasValidAccess(userId, gbpAccountId);

    if (!access.hasAccess) {
      console.error(`[SubscriptionGuard] ❌ Automation blocked: ${automationType} for user ${userId}`);
      console.error(`[SubscriptionGuard] Reason: ${access.message}`);

      // Ensure features are disabled
      await this.disableAllFeatures(userId, gbpAccountId, access.reason);

      return {
        allowed: false,
        reason: access.reason,
        message: access.message
      };
    }

    console.log(`[SubscriptionGuard] ✅ ${automationType} ALLOWED for user ${userId} - Status: ${access.status}, Days remaining: ${access.daysRemaining}`);
    return {
      allowed: true,
      status: access.status,
      daysRemaining: access.daysRemaining
    };
  }
}

// Create singleton instance
const subscriptionGuard = new SubscriptionGuard();

export default subscriptionGuard;

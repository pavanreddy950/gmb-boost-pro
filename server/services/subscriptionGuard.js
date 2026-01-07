import supabaseSubscriptionService from './supabaseSubscriptionService.js';
import supabaseAutomationService from './supabaseAutomationService.js';
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
   */
  async isAdmin(userId) {
    // Firebase Admin SDK disabled for Node.js v25 compatibility
    console.log('[SubscriptionGuard] ⚠️ Admin check skipped (Firebase disabled)');
    return false;
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

      // Try to find subscription by GBP account ID first
      let subscription = null;

      if (gbpAccountId) {
        subscription = await supabaseSubscriptionService.getSubscriptionByGbpId(gbpAccountId);
      }

      // 🔧 FIX: If no subscription found by gbpAccountId, try to find by userId
      if (!subscription && userId) {
        console.log(`[SubscriptionGuard] 🔄 No subscription found by GBP ID, trying userId: ${userId}`);
        subscription = await supabaseSubscriptionService.getSubscriptionByUserId(userId);
      }

      if (!subscription) {
        console.log(`[SubscriptionGuard] ❌ No subscription found for gbpAccountId: ${gbpAccountId}, userId: ${userId}`);
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

        // CRITICAL FIX: If trial has no end date, treat as active trial (30 days from creation)
        if (!trialEndDate) {
          console.log(`[SubscriptionGuard] ✅ Trial with no end date - treating as active trial`);
          return {
            hasAccess: true,
            status: 'trial',
            daysRemaining: 30, // Default trial period
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
   * NOTE: Auto-posting is now ALWAYS ALLOWED to ensure consistent posting for all profiles
   */
  async validateBeforeAutomation(userId, gbpAccountId, automationType) {
    // 🚀 ALWAYS ALLOW AUTO-POSTING - User requested all profiles must post consistently
    // Subscription checks are bypassed for auto-posting to ensure no profiles are missed
    if (automationType === 'auto_posting') {
      console.log(`[SubscriptionGuard] ✅ Auto-posting ALWAYS ALLOWED for user ${userId}`);
      return {
        allowed: true,
        status: 'always_enabled',
        daysRemaining: 999999,
        message: 'Auto-posting is always enabled for all profiles'
      };
    }

    // For other automation types, still check subscription
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

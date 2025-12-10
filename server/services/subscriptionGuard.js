import supabaseSubscriptionService from './supabaseSubscriptionService.js';
import supabaseAutomationService from './supabaseAutomationService.js';
import admin from 'firebase-admin';

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
    try {
      if (!userId) return false;

      // Get user from Firebase
      const userRecord = await admin.auth().getUser(userId);
      
      // Check custom claims for admin role
      if (userRecord.customClaims && userRecord.customClaims.role === 'admin') {
        console.log(`[SubscriptionGuard] ✅ User ${userId} is ADMIN - bypassing subscription checks`);
        return true;
      }

      return false;
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

      const subscription = await supabaseSubscriptionService.getSubscriptionByGbpId(gbpAccountId);

      if (!subscription) {
        return {
          hasAccess: false,
          reason: 'no_subscription',
          message: 'No subscription found. Please start a free trial.',
          requiresPayment: true
        };
      }

      const now = new Date();

      // Check if active subscription
      if (subscription.status === 'active') {
        const endDate = subscription.subscriptionEndDate ? new Date(subscription.subscriptionEndDate) : null;

        if (endDate && endDate > now) {
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

        if (trialEndDate && trialEndDate > now) {
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
        await supabaseAutomationService.saveSettings(userId, setting.location_id, {
          ...setting.settings,
          enabled: false,
          autoPosting: {
            ...setting.settings?.autoPosting,
            enabled: false
          },
          autoReply: {
            ...setting.settings?.autoReply,
            enabled: false
          },
          autoReplyEnabled: false,
          disabledReason: reason,
          disabledAt: new Date().toISOString()
        });

        console.log(`[SubscriptionGuard] ✅ Disabled automation for location: ${setting.location_id}`);
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
   */
  async validateBeforeAutomation(userId, gbpAccountId, automationType) {
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

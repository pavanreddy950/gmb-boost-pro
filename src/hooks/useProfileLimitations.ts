import { useCallback } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useGoogleBusinessProfileContext } from '@/contexts/GoogleBusinessProfileContext';
import { BusinessAccount, BusinessLocation } from '@/lib/googleBusinessProfile';

interface ProfileLimitations {
  // Plan checks
  canAccessMultipleProfiles: boolean;
  isProPlan: boolean;
  isPerProfilePlan: boolean;
  maxAllowedProfiles: number;

  // Account limitations
  getAccessibleAccounts: (accounts: BusinessAccount[]) => BusinessAccount[];
  isAccountAccessible: (accountIndex: number) => boolean;

  // Location limitations
  getAccessibleLocations: (locations: BusinessLocation[]) => BusinessLocation[];
  isLocationAccessible: (locationIndex: number) => boolean;

  // UI helpers
  getAccountLockMessage: (totalAccounts: number) => string;
  getLocationLockMessage: (totalLocations: number) => string;

  // Support contact
  handleContactSupport: (context?: string) => void;
}

export const useProfileLimitations = (): ProfileLimitations => {
  const { subscription, status } = useSubscription();
  const { accounts, selectedAccount } = useGoogleBusinessProfileContext();

  // Check plan types
  // 🔧 FIX: Check both planId AND status for admin users
  const isAdminPlan = subscription?.planId === 'unlimited' || status === 'admin' || subscription?.isAdmin === true;
  const isPerProfilePlan = subscription?.planId === 'per_profile_yearly';
  const isProPlan = subscription?.planId === 'yearly_pro'; // Legacy plan
  const isFreeTrial = subscription?.status === 'trial';

  // Calculate max allowed profiles based on plan
  // IMPORTANT: Use paidSlots (not profileCount) for slot-based subscription
  // paidSlots = what user paid for (never decreases)
  // profileCount = current active profiles (can increase/decrease)
  const maxAllowedProfiles = isAdminPlan
    ? 999999 // Unlimited for admins
    : subscription?.paidSlots && subscription.paidSlots > 0
    ? subscription.paidSlots // FIXED: Use paidSlots for ANY subscription that has paid slots
    : subscription?.status === 'active' && subscription?.profileCount
    ? subscription.profileCount // Fallback: Use profileCount for active subscriptions
    : 1; // Default: Trial users get 1 profile

  // Check if user can access multiple profiles
  const canAccessMultipleProfiles = isAdminPlan || maxAllowedProfiles > 1;

  // Get accessible accounts based on plan limits
  // Only count ACTIVE profiles (not suspended or duplicates)
  const getAccessibleAccounts = useCallback((allAccounts: BusinessAccount[]): BusinessAccount[] => {
    // Filter out suspended and duplicate profiles - these shouldn't count toward limits
    const activeAccounts = allAccounts.filter(account => {
      const location = account.locations?.[0]; // Each BusinessAccount has one location
      return !location?.metadata?.suspended && !location?.metadata?.duplicate;
    });

    // If user's plan covers all active profiles, return all accounts (including suspended for info)
    if (maxAllowedProfiles >= activeAccounts.length) {
      return allAccounts; // Return all so user can see suspended ones with locked state
    }

    // Otherwise, only return the allowed number of active profiles
    return activeAccounts.slice(0, maxAllowedProfiles);
  }, [maxAllowedProfiles]);

  // Check if specific account is accessible
  const isAccountAccessible = useCallback((accountIndex: number): boolean => {
    return accountIndex < maxAllowedProfiles;
  }, [maxAllowedProfiles]);

  // Get accessible locations based on plan limits (count only active locations)
  const getAccessibleLocations = useCallback((allLocations: BusinessLocation[]): BusinessLocation[] => {
    // Filter out suspended and duplicate locations - these shouldn't count toward limits
    const activeLocations = allLocations.filter(location => {
      return !location?.metadata?.suspended && !location?.metadata?.duplicate;
    });

    // If user's plan covers all active locations, return all (including suspended for info)
    if (maxAllowedProfiles >= activeLocations.length) {
      return allLocations; // Return all so user can see suspended ones with locked state
    }

    // Otherwise, only return the allowed number of active locations
    return activeLocations.slice(0, maxAllowedProfiles);
  }, [maxAllowedProfiles]);

  // Check if specific location is accessible
  const isLocationAccessible = useCallback((locationIndex: number): boolean => {
    return locationIndex < maxAllowedProfiles;
  }, [maxAllowedProfiles]);

  // Get message for locked accounts
  const getAccountLockMessage = useCallback((totalAccounts: number): string => {
    if (isAdminPlan || totalAccounts <= maxAllowedProfiles) return '';

    if (isFreeTrial) {
      return `You have ${totalAccounts} Google Business accounts. Your Free Trial allows access to 1 account only. Upgrade to access more profiles.`;
    } else if (isPerProfilePlan) {
      return `You have ${totalAccounts} accounts but your plan covers ${maxAllowedProfiles} profile${maxAllowedProfiles > 1 ? 's' : ''}. Upgrade your plan to access more profiles at $99/profile/year.`;
    } else if (isProPlan) {
      return `You have ${totalAccounts} Google Business accounts. Your current plan allows access to 1 account only. Upgrade to access more profiles.`;
    }
    return `Your current plan allows access to ${maxAllowedProfiles} account${maxAllowedProfiles > 1 ? 's' : ''} only.`;
  }, [maxAllowedProfiles, isAdminPlan, isFreeTrial, isPerProfilePlan, isProPlan]);

  // Get message for locked locations
  const getLocationLockMessage = useCallback((totalLocations: number): string => {
    if (isAdminPlan || totalLocations <= maxAllowedProfiles) return '';

    if (isFreeTrial) {
      return `This account has ${totalLocations} locations. Your Free Trial allows access to 1 location only. Upgrade to access more profiles.`;
    } else if (isPerProfilePlan) {
      return `You have ${totalLocations} locations but your plan covers ${maxAllowedProfiles} profile${maxAllowedProfiles > 1 ? 's' : ''}. Upgrade your plan to access more profiles at $99/profile/year.`;
    } else if (isProPlan) {
      return `This account has ${totalLocations} locations. Your current plan allows access to 1 location only. Upgrade to access more profiles.`;
    }
    return `Your current plan allows access to ${maxAllowedProfiles} location${maxAllowedProfiles > 1 ? 's' : ''} only.`;
  }, [maxAllowedProfiles, isAdminPlan, isFreeTrial, isPerProfilePlan, isProPlan]);

  // Handle support contact
  const handleContactSupport = useCallback((context: string = 'Support Request'): void => {
    const subject = encodeURIComponent(`Support Request - ${context}`);
    const body = encodeURIComponent(`Hi,

I need assistance with my GMB Profile Pulse account.

Current plan: ${subscription?.planName || 'Free Trial'}
Paid slots: ${subscription?.paidSlots || subscription?.profileCount || 1}
Active profiles: ${subscription?.profileCount || 1}
Context: ${context}

Please contact me to discuss.

Best regards,`);

    window.open(`mailto:support@gmbprofilepulse.com?subject=${subject}&body=${body}`, '_blank');
  }, [subscription?.planName, subscription?.profileCount, subscription?.paidSlots]);

  return {
    canAccessMultipleProfiles,
    isProPlan,
    isPerProfilePlan,
    maxAllowedProfiles,
    getAccessibleAccounts,
    isAccountAccessible,
    getAccessibleLocations,
    isLocationAccessible,
    getAccountLockMessage,
    getLocationLockMessage,
    handleContactSupport,
  };
};
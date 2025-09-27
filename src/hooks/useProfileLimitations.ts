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
  const isPerProfilePlan = subscription?.planId === 'per_profile_yearly';
  const isProPlan = subscription?.planId === 'yearly_pro'; // Legacy plan
  const isFreeTrial = subscription?.status === 'trial';

  // Calculate max allowed profiles based on plan
  const maxAllowedProfiles = isPerProfilePlan
    ? (subscription?.profileCount || 1)
    : 1; // Trial and legacy pro plans get 1 profile

  // Check if user can access multiple profiles
  const canAccessMultipleProfiles = maxAllowedProfiles > 1;

  // Get accessible accounts based on plan limits
  const getAccessibleAccounts = useCallback((allAccounts: BusinessAccount[]): BusinessAccount[] => {
    if (maxAllowedProfiles >= allAccounts.length) {
      return allAccounts;
    }
    return allAccounts.slice(0, maxAllowedProfiles);
  }, [maxAllowedProfiles]);

  // Check if specific account is accessible
  const isAccountAccessible = useCallback((accountIndex: number): boolean => {
    return accountIndex < maxAllowedProfiles;
  }, [maxAllowedProfiles]);

  // Get accessible locations based on plan limits (count all locations across accounts)
  const getAccessibleLocations = useCallback((allLocations: BusinessLocation[]): BusinessLocation[] => {
    if (maxAllowedProfiles >= allLocations.length) {
      return allLocations;
    }
    return allLocations.slice(0, maxAllowedProfiles);
  }, [maxAllowedProfiles]);

  // Check if specific location is accessible
  const isLocationAccessible = useCallback((locationIndex: number): boolean => {
    return locationIndex < maxAllowedProfiles;
  }, [maxAllowedProfiles]);

  // Get message for locked accounts
  const getAccountLockMessage = useCallback((totalAccounts: number): string => {
    if (totalAccounts <= maxAllowedProfiles) return '';

    if (isFreeTrial) {
      return `You have ${totalAccounts} Google Business accounts. Your Free Trial allows access to 1 account only. Upgrade to access more profiles.`;
    } else if (isPerProfilePlan) {
      return `You have ${totalAccounts} accounts but your plan covers ${maxAllowedProfiles} profile${maxAllowedProfiles > 1 ? 's' : ''}. Upgrade your plan to access more profiles at $99/profile/year.`;
    } else if (isProPlan) {
      return `You have ${totalAccounts} Google Business accounts. Your current plan allows access to 1 account only. Upgrade to access more profiles.`;
    }
    return `Your current plan allows access to ${maxAllowedProfiles} account${maxAllowedProfiles > 1 ? 's' : ''} only.`;
  }, [maxAllowedProfiles, isFreeTrial, isPerProfilePlan, isProPlan]);

  // Get message for locked locations
  const getLocationLockMessage = useCallback((totalLocations: number): string => {
    if (totalLocations <= maxAllowedProfiles) return '';

    if (isFreeTrial) {
      return `This account has ${totalLocations} locations. Your Free Trial allows access to 1 location only. Upgrade to access more profiles.`;
    } else if (isPerProfilePlan) {
      return `You have ${totalLocations} locations but your plan covers ${maxAllowedProfiles} profile${maxAllowedProfiles > 1 ? 's' : ''}. Upgrade your plan to access more profiles at $99/profile/year.`;
    } else if (isProPlan) {
      return `This account has ${totalLocations} locations. Your current plan allows access to 1 location only. Upgrade to access more profiles.`;
    }
    return `Your current plan allows access to ${maxAllowedProfiles} location${maxAllowedProfiles > 1 ? 's' : ''} only.`;
  }, [maxAllowedProfiles, isFreeTrial, isPerProfilePlan, isProPlan]);

  // Handle support contact
  const handleContactSupport = useCallback((context: string = 'Support Request'): void => {
    const subject = encodeURIComponent(`Support Request - ${context}`);
    const body = encodeURIComponent(`Hi,

I need assistance with my GMB Profile Pulse account.

Current plan: ${subscription?.planName || 'Free Trial'}
Current profile count: ${subscription?.profileCount || 1}
Context: ${context}

Please contact me to discuss.

Best regards,`);

    window.open(`mailto:support@gmbprofilepulse.com?subject=${subject}&body=${body}`, '_blank');
  }, [subscription?.planName, subscription?.profileCount]);

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
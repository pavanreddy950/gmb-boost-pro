import React from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useGoogleBusinessProfileContext } from '@/contexts/GoogleBusinessProfileContext';
import { TrialSetupModal } from './TrialSetupModal';

export const TrialManager: React.FC = () => {
  const { showTrialSetup, setShowTrialSetup } = useSubscription();
  const { accounts } = useGoogleBusinessProfileContext();

  // Get the first GBP account ID
  const gbpAccountId = accounts && accounts.length > 0
    ? accounts[0].name?.split('/')[1] || accounts[0].accountId
    : '';

  // Calculate total profiles
  const totalProfiles = accounts?.reduce((total, account) => {
    return total + (account.locations?.length || 0);
  }, 0) || 1;

  if (!showTrialSetup || !gbpAccountId) {
    return null;
  }

  return (
    <TrialSetupModal
      isOpen={showTrialSetup}
      onClose={() => setShowTrialSetup(false)}
      gbpAccountId={gbpAccountId}
      profileCount={Math.max(1, totalProfiles)}
    />
  );
};
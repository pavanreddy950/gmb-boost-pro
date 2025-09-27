import React, { createContext, useContext, ReactNode } from 'react';
import { useGoogleBusinessProfile } from '@/hooks/useGoogleBusinessProfile';
import { BusinessAccount, BusinessLocation } from '@/lib/googleBusinessProfile';

interface GoogleBusinessProfileContextType {
  isConnected: boolean;
  isLoading: boolean;
  accounts: BusinessAccount[];
  selectedAccount: BusinessAccount | null;
  selectedLocation: BusinessLocation | null;
  error: string | null;
  connectGoogleBusiness: () => void;
  disconnectGoogleBusiness: () => Promise<void>;
  selectAccount: (account: BusinessAccount) => void;
  selectLocation: (location: BusinessLocation) => void;
  refreshAccounts: () => Promise<void>;
  handleOAuthCallback: (code: string) => Promise<void>;
}

const GoogleBusinessProfileContext = createContext<GoogleBusinessProfileContextType | undefined>(undefined);

interface GoogleBusinessProfileProviderProps {
  children: ReactNode;
}

export const GoogleBusinessProfileProvider: React.FC<GoogleBusinessProfileProviderProps> = ({ children }) => {
  const googleBusinessProfile = useGoogleBusinessProfile();

  return (
    <GoogleBusinessProfileContext.Provider value={googleBusinessProfile}>
      {children}
    </GoogleBusinessProfileContext.Provider>
  );
};

export const useGoogleBusinessProfileContext = (): GoogleBusinessProfileContextType => {
  const context = useContext(GoogleBusinessProfileContext);
  if (context === undefined) {
    throw new Error('useGoogleBusinessProfileContext must be used within a GoogleBusinessProfileProvider');
  }
  return context;
};

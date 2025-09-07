import { useState, useEffect, useCallback } from 'react';
import { BusinessAccount, BusinessLocation, googleBusinessProfileService } from '@/lib/googleBusinessProfile';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface UseGoogleBusinessProfileReturn {
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

export const useGoogleBusinessProfile = (): UseGoogleBusinessProfileReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<BusinessAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BusinessAccount | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<BusinessLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Load business accounts
  const loadBusinessAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const businessAccounts = await googleBusinessProfileService.getBusinessAccounts();
      setAccounts(businessAccounts);
      
      // Auto-select first account if only one exists
      if (businessAccounts.length === 1) {
        setSelectedAccount(businessAccounts[0]);
        
        // Auto-select first location if only one exists
        if (businessAccounts[0].locations.length === 1) {
          setSelectedLocation(businessAccounts[0].locations[0]);
        }
      }
      
      setError(null);
    } catch (error) {
      console.error('Error loading business accounts:', error);
      setError('Failed to load business accounts');
      toast({
        title: "Error loading accounts",
        description: "Failed to load your Google Business Profile accounts. Please try reconnecting.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Initialize and check existing connection
  useEffect(() => {
    const initializeConnection = async () => {
      setIsLoading(true);
      console.log('🔍 DEBUGGING: Initializing Google Business Profile connection...');
      console.log('🔍 DEBUGGING: Firebase user:', currentUser?.uid);
      
      try {
        // Set the current user ID in the service for Firestore operations
        googleBusinessProfileService.setCurrentUserId(currentUser?.uid || null);
        
        // Load tokens with Firebase user ID
        const hasValidTokens = await googleBusinessProfileService.loadStoredTokens(currentUser?.uid);
        console.log('🔍 DEBUGGING: Has valid tokens?', hasValidTokens);
        console.log('🔍 DEBUGGING: Service isConnected?', googleBusinessProfileService.isConnected());
        console.log('🔍 DEBUGGING: LocalStorage tokens:', localStorage.getItem('google_business_tokens'));
        console.log('🔍 DEBUGGING: LocalStorage connected flag:', localStorage.getItem('google_business_connected'));
        
        setIsConnected(hasValidTokens);
        
        if (hasValidTokens) {
          console.log('🔍 DEBUGGING: Loading business accounts...');
          await loadBusinessAccounts();
        } else {
          console.log('🔍 DEBUGGING: No valid tokens, skipping account load');
        }
      } catch (error) {
        console.error('❌ DEBUGGING: Error initializing Google Business Profile connection:', error);
        setError('Failed to initialize connection');
      } finally {
        setIsLoading(false);
        console.log('🔍 DEBUGGING: Initialization complete. Final state - isConnected:', isConnected);
      }
    };

    // Listen for connection events from OAuth callback
    const handleConnectionEvent = async (event: CustomEvent) => {
      console.log('Google Business Profile connection event received:', event.detail);
      setIsConnected(true);
      await loadBusinessAccounts();
      toast({
        title: "Connection successful!",
        description: "Loading your business profiles...",
      });
      
      // Redirect to dashboard after successful OAuth callback connection
      console.log('🔄 Redirecting to dashboard after OAuth callback...');
      navigate('/dashboard');
    };

    window.addEventListener('googleBusinessProfileConnected', handleConnectionEvent as EventListener);
    
    initializeConnection();

    return () => {
      window.removeEventListener('googleBusinessProfileConnected', handleConnectionEvent as EventListener);
    };
  }, [toast, loadBusinessAccounts, currentUser, navigate]);

  // Connect to Google Business Profile (frontend-only)
  const connectGoogleBusiness = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Starting Google Business Profile connection...');
      console.log('🔍 DEBUGGING: Firebase user for connection:', currentUser?.uid);
      
      // Set the current user ID in the service before connecting
      googleBusinessProfileService.setCurrentUserId(currentUser?.uid || null);
      
      await googleBusinessProfileService.connectGoogleBusiness();
      setIsConnected(true);
      console.log('✅ OAuth connection successful!');
      
      // Load business accounts immediately after connection
      console.log('📊 Loading business accounts...');
      await loadBusinessAccounts();
      console.log('✅ Business accounts loaded successfully!');
      
      toast({
        title: "Connected successfully!",
        description: "Your Google Business Profile has been connected and data loaded.",
      });

      // Redirect to dashboard after successful connection
      console.log('🔄 Redirecting to dashboard...');
      navigate('/dashboard');
    } catch (error) {
      console.error('❌ Error connecting to Google Business Profile:', error);
      setError('Failed to connect');
      toast({
        title: "Connection failed",
        description: "Failed to connect to Google Business Profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [loadBusinessAccounts, toast, currentUser, navigate]);


  // Disconnect from Google Business Profile
  const disconnectGoogleBusiness = useCallback(async () => {
    try {
      setIsLoading(true);
      await googleBusinessProfileService.disconnect();
      setIsConnected(false);
      setAccounts([]);
      setSelectedAccount(null);
      setSelectedLocation(null);
      setError(null);
      
      toast({
        title: "Disconnected",
        description: "Your Google Business Profile has been disconnected.",
      });
    } catch (error) {
      console.error('Error disconnecting Google Business Profile:', error);
      toast({
        title: "Disconnection failed",
        description: "Failed to disconnect. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Select an account
  const selectAccount = useCallback((account: BusinessAccount) => {
    setSelectedAccount(account);
    setSelectedLocation(null); // Reset location selection
  }, []);

  // Select a location
  const selectLocation = useCallback((location: BusinessLocation) => {
    setSelectedLocation(location);
  }, []);

  // Refresh accounts
  const refreshAccounts = useCallback(async () => {
    if (isConnected) {
      await loadBusinessAccounts();
    }
  }, [isConnected, loadBusinessAccounts]);

  // Handle OAuth callback (placeholder - not used in current implementation)
  const handleOAuthCallback = useCallback(async (code: string) => {
    console.log('OAuth callback received (not implemented in current frontend-only flow):', code);
  }, []);

  return {
    isConnected,
    isLoading,
    accounts,
    selectedAccount,
    selectedLocation,
    error,
    connectGoogleBusiness,
    disconnectGoogleBusiness,
    selectAccount,
    selectLocation,
    refreshAccounts,
    handleOAuthCallback,
  };
};


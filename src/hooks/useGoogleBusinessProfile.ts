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

  // Save GBP-user association
  const saveGbpAssociation = useCallback(async (gbpAccountId: string) => {
    if (!currentUser?.uid) return;

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
      await fetch(`${backendUrl}/api/payment/user/gbp-association`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          gbpAccountId: gbpAccountId
        })
      });
      console.log('GBP association saved:', { userId: currentUser.uid, gbpAccountId });
    } catch (error) {
      console.error('Failed to save GBP association:', error);
    }
  }, [currentUser]);

  // Load business accounts
  const loadBusinessAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const businessAccounts = await googleBusinessProfileService.getBusinessAccounts();
      setAccounts(businessAccounts);

      // Save GBP associations for all accounts
      for (const account of businessAccounts) {
        if (account.accountId) {
          await saveGbpAssociation(account.accountId);
        }
      }

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
  }, [toast, saveGbpAssociation]);

  // Enhanced automatic token refresh with connection monitoring
  useEffect(() => {
    if (!isConnected) return;

    let refreshInterval: NodeJS.Timeout;
    let healthCheckInterval: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 3;

    const performTokenRefresh = async () => {
      try {
        console.log('⏰ Checking token expiry...');
        if (googleBusinessProfileService.isTokenExpired()) {
          console.log('🔄 Token expired or expiring soon, refreshing...');
          await googleBusinessProfileService.refreshAccessToken();
          retryCount = 0; // Reset retry count on success

          // Validate connection after refresh
          await performConnectionHealthCheck();

          toast({
            title: "Connection refreshed",
            description: "Your Google Business Profile connection has been renewed.",
          });
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
        retryCount++;

        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying token refresh (attempt ${retryCount}/${maxRetries})...`);
          // Retry after exponential backoff (2s, 4s, 8s)
          setTimeout(() => performTokenRefresh(), Math.pow(2, retryCount) * 1000);
        } else {
          console.error('❌ Max token refresh retries exceeded, attempting connection recovery...');

          // Try connection recovery before giving up
          try {
            const recovered = await googleBusinessProfileService.recoverConnection();
            if (recovered) {
              console.log('✅ Connection recovered successfully');
              retryCount = 0; // Reset retry count
              toast({
                title: "Connection recovered",
                description: "Your Google Business Profile connection has been restored.",
              });
              return;
            }
          } catch (recoveryError) {
            console.error('❌ Connection recovery failed:', recoveryError);
          }

          // If recovery failed, mark as disconnected
          setIsConnected(false);
          setError('Connection lost due to authentication failure');
          toast({
            title: "Connection lost",
            description: "Unable to refresh your Google Business Profile connection. Please reconnect manually.",
            variant: "destructive",
          });
        }
      }
    };

    // Connection health check to verify the connection is working
    const performConnectionHealthCheck = async () => {
      try {
        console.log('🏥 Performing connection health check...');
        const isValid = await googleBusinessProfileService.validateTokens();
        if (!isValid) {
          console.warn('⚠️ Token validation failed during health check');
          throw new Error('Token validation failed');
        }
        console.log('✅ Connection health check passed');
      } catch (error) {
        console.error('❌ Connection health check failed:', error);
        // Don't immediately disconnect on health check failure
        // Let the token refresh mechanism handle it
      }
    };

    // Check and refresh token every 15 minutes (optimized frequency)
    refreshInterval = setInterval(performTokenRefresh, 15 * 60 * 1000); // 15 minutes

    // Perform health check every 30 minutes
    healthCheckInterval = setInterval(performConnectionHealthCheck, 30 * 60 * 1000); // 30 minutes

    // Initial token check when component mounts
    const initialCheck = async () => {
      try {
        if (googleBusinessProfileService.isTokenExpired()) {
          console.log('🔄 Initial token check: token expired, refreshing...');
          await googleBusinessProfileService.refreshAccessToken();
        }
        await performConnectionHealthCheck();
      } catch (error) {
        console.error('Initial connection check failed:', error);
        setError('Initial connection validation failed');
      }
    };
    initialCheck();

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
    };
  }, [isConnected, toast]);

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


import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Track initialization to prevent multiple concurrent initializations
  const isInitializing = useRef(false);
  const hasInitialized = useRef(false);
  const lastUserId = useRef<string | null>(null);

  // Store stable references to functions to avoid dependency issues
  const loadBusinessAccountsRef = useRef(loadBusinessAccounts);
  const toastRef = useRef(toast);
  const navigateRef = useRef(navigate);

  // Update refs when functions change
  useEffect(() => {
    loadBusinessAccountsRef.current = loadBusinessAccounts;
    toastRef.current = toast;
    navigateRef.current = navigate;
  }, [loadBusinessAccounts, toast, navigate]);

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

  // Aggressive automatic token refresh - never let connection die
  useEffect(() => {
    if (!isConnected) return;

    let refreshInterval: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 5; // More retry attempts

    const performTokenRefresh = async () => {
      try {
        console.log('⏰ Proactive token check...');

        // Check if token is expired or expiring soon (within 30 minutes)
        if (googleBusinessProfileService.isTokenExpired()) {
          console.log('🔄 Token expiring soon, refreshing proactively...');
          await googleBusinessProfileService.refreshAccessToken();
          retryCount = 0; // Reset on success

          console.log('✅ Token refreshed successfully - connection remains permanent');
        } else {
          console.log('✅ Token still valid - no refresh needed');
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
        retryCount++;

        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying token refresh (attempt ${retryCount}/${maxRetries})...`);
          // Retry with exponential backoff
          setTimeout(() => performTokenRefresh(), Math.pow(2, retryCount) * 1000);
        } else {
          console.error('❌ Max retries exceeded, attempting recovery...');

          // Try connection recovery
          try {
            const recovered = await googleBusinessProfileService.recoverConnection();
            if (recovered) {
              console.log('✅ Connection recovered via stored tokens');
              retryCount = 0;
              return;
            }
          } catch (recoveryError) {
            console.error('❌ Recovery failed:', recoveryError);
          }

          // Only mark as disconnected after all recovery attempts fail
          setIsConnected(false);
          setError('Connection requires re-authentication');

          toast({
            title: "Connection expired",
            description: "Please reconnect your Google Business Profile from Settings.",
            variant: "destructive",
          });
        }
      }
    };

    // Aggressive refresh: Check every 10 minutes to ensure token never expires
    refreshInterval = setInterval(performTokenRefresh, 10 * 60 * 1000); // 10 minutes

    // Immediate check on mount
    const initialCheck = async () => {
      try {
        console.log('🔍 Initial connection check on mount...');

        // If token is expiring soon, refresh immediately
        if (googleBusinessProfileService.isTokenExpired()) {
          console.log('🔄 Token expiring, refreshing immediately...');
          await googleBusinessProfileService.refreshAccessToken();
        }

        console.log('✅ Connection verified - permanent connection active');
      } catch (error) {
        console.error('Initial check failed:', error);
        // Try to recover instead of failing
        await performTokenRefresh();
      }
    };

    initialCheck();

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isConnected, toast]);

  // Initialize and check existing connection
  useEffect(() => {
    const currentUserId = currentUser?.uid || null;

    // Skip if already initializing or if user hasn't changed
    if (isInitializing.current || (hasInitialized.current && lastUserId.current === currentUserId)) {
      console.log('🔍 DEBUGGING: Skipping initialization (already initialized or in progress)');
      return;
    }

    const initializeConnection = async () => {
      // Prevent concurrent initializations
      if (isInitializing.current) {
        console.log('🔍 DEBUGGING: Initialization already in progress, skipping...');
        return;
      }

      isInitializing.current = true;
      setIsLoading(true);
      console.log('🔍 DEBUGGING: Initializing Google Business Profile connection...');
      console.log('🔍 DEBUGGING: Firebase user:', currentUserId);

      try {
        // Set the current user ID in the service for Firestore operations
        googleBusinessProfileService.setCurrentUserId(currentUserId);

        // Check if we just reloaded after payment
        const justReloaded = sessionStorage.getItem('post_payment_reload') === 'true';
        if (justReloaded) {
          console.log('🔍 DEBUGGING: Just reloaded after payment, waiting before loading profiles...');
          sessionStorage.removeItem('post_payment_reload');
          // Wait a bit longer for backend to settle and tokens to be saved
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Load tokens with Firebase user ID
        const hasValidTokens = await googleBusinessProfileService.loadStoredTokens(currentUserId);
        console.log('🔍 DEBUGGING: Has valid tokens?', hasValidTokens);
        console.log('🔍 DEBUGGING: Service isConnected?', googleBusinessProfileService.isConnected());

        setIsConnected(hasValidTokens);

        if (hasValidTokens) {
          console.log('🔍 DEBUGGING: Loading business accounts...');
          try {
            await loadBusinessAccountsRef.current();
          } catch (loadError) {
            console.error('❌ DEBUGGING: Failed to load business accounts:', loadError);
            // Don't set error state if it's just a temporary issue
            // Let the automatic refresh retry handle it
            if (loadError instanceof Error && loadError.message.includes('Authentication')) {
              console.log('⚠️ Authentication issue detected, may need to reconnect');
              setError('Authentication expired. Please reconnect your Google Business Profile.');
              setIsConnected(false);
            }
          }
        } else {
          console.log('🔍 DEBUGGING: No valid tokens, skipping account load');
        }

        // Mark as initialized
        hasInitialized.current = true;
        lastUserId.current = currentUserId;
      } catch (error) {
        console.error('❌ DEBUGGING: Error initializing Google Business Profile connection:', error);
        setError('Failed to initialize connection');
      } finally {
        setIsLoading(false);
        isInitializing.current = false;
        console.log('🔍 DEBUGGING: Initialization complete');
      }
    };

    // Listen for connection events from OAuth callback
    const handleConnectionEvent = async (event: CustomEvent) => {
      console.log('Google Business Profile connection event received:', event.detail);
      setIsConnected(true);
      await loadBusinessAccountsRef.current();
      toastRef.current({
        title: "Connection successful!",
        description: "Loading your business profiles...",
      });

      // Redirect to dashboard after successful OAuth callback connection
      console.log('🔄 Redirecting to dashboard after OAuth callback...');
      navigateRef.current('/dashboard');
    };

    window.addEventListener('googleBusinessProfileConnected', handleConnectionEvent as EventListener);

    initializeConnection();

    return () => {
      window.removeEventListener('googleBusinessProfileConnected', handleConnectionEvent as EventListener);
    };
    // Only re-initialize if the user ID actually changes
  }, [currentUser?.uid]);

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);

      // Provide user-friendly error messages
      let description = "Failed to connect to Google Business Profile. Please try again.";
      if (errorMessage.includes('cancelled') || errorMessage.includes('closed')) {
        description = "OAuth was cancelled. Please try again and complete the authentication process.";
      } else if (errorMessage.includes('timeout')) {
        description = "Connection timed out. Please try again.";
      } else if (errorMessage.includes('Popup blocked')) {
        description = "Popup was blocked. Please allow popups for this site and try again.";
      }

      toast({
        title: "Connection failed",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [loadBusinessAccounts, toast, currentUser, navigate]);


  // Permanently disconnect from Google Business Profile (delete tokens everywhere)
  const disconnectGoogleBusiness = useCallback(async () => {
    try {
      setIsLoading(true);
      // Use permanentDisconnect when user explicitly clicks Disconnect in Settings
      await googleBusinessProfileService.permanentDisconnect();
      setIsConnected(false);
      setAccounts([]);
      setSelectedAccount(null);
      setSelectedLocation(null);
      setError(null);

      toast({
        title: "Disconnected",
        description: "Your Google Business Profile has been permanently disconnected.",
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


import { useState, useEffect, useCallback, useRef } from 'react';
import { BusinessAccount, BusinessLocation, googleBusinessProfileService } from '@/lib/googleBusinessProfile';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { tokenInvalidationService } from '@/lib/tokenInvalidationService';

interface UseGoogleBusinessProfileReturn {
  isConnected: boolean;
  isLoading: boolean;
  accounts: BusinessAccount[];
  selectedAccount: BusinessAccount | null;
  selectedLocation: BusinessLocation | null;
  error: string | null;
  needsReauth: boolean;
  reauthReason: string;
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
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthReason, setReauthReason] = useState<string>('');
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Track initialization to prevent multiple concurrent initializations
  const isInitializing = useRef(false);
  const hasInitialized = useRef(false);
  const lastUserId = useRef<string | null>(null);

  // Track saved associations to prevent repeated saves (SESSION CACHE)
  const savedAssociations = useRef<Set<string>>(new Set());
  const savedProfileCounts = useRef<Map<string, number>>(new Map());

  // Save GBP-user association (ONLY ONCE PER SESSION)
  const saveGbpAssociation = useCallback(async (gbpAccountId: string) => {
    if (!currentUser?.uid) return;

    // Skip if already saved in this session
    const cacheKey = `${currentUser.uid}_${gbpAccountId}`;
    if (savedAssociations.current.has(cacheKey)) {
      return; // Already saved, skip
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';
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

      // Mark as saved
      savedAssociations.current.add(cacheKey);
    } catch (error) {
      // Silent fail - not critical
    }
  }, [currentUser]);

  // Update profile count (ONLY IF CHANGED)
  // UNIVERSAL: Works for all users - sends email for reliable lookup
  const updateProfileCount = useCallback(async (gbpAccountId: string, profileCount: number) => {
    if (!currentUser?.uid || !currentUser?.email) return;

    // Skip if count hasn't changed (use global key for total count)
    const cacheKey = 'total_profile_count';
    const lastCount = savedProfileCounts.current.get(cacheKey);
    if (lastCount === profileCount) {
      console.log('[Profile Count] No change detected, skipping update');
      return; // No change, skip
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';

      console.log('[Profile Count] Sending update:', {
        userId: currentUser.uid,
        email: currentUser.email,
        gbpAccountId,
        currentProfileCount: profileCount
      });

      const response = await fetch(`${backendUrl}/api/payment/subscription/update-profile-count`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email, // CRITICAL: Include email for universal lookup
          gbpAccountId: gbpAccountId,
          currentProfileCount: profileCount
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Profile Count] ✅ Update successful:', result);
        // Update cache
        savedProfileCounts.current.set(cacheKey, profileCount);
      } else {
        const error = await response.json();
        console.error('[Profile Count] ❌ Update failed:', error);
      }
    } catch (error) {
      console.error('[Profile Count] ❌ Request error:', error);
    }
  }, [currentUser]);

  // Load business accounts
  const loadBusinessAccounts = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setIsLoading(true);
      const businessAccounts = await googleBusinessProfileService.getBusinessAccounts(forceRefresh);
      setAccounts(businessAccounts);

      // Save GBP associations for all accounts
      await Promise.all(
        businessAccounts.map(async (account) => {
          if (account.accountId) {
            await saveGbpAssociation(account.accountId);
          }
        })
      );

      // UNIVERSAL PROFILE COUNT UPDATE - Works for ALL scenarios:
      // - Single account with 1 location
      // - Single account with multiple locations
      // - Multiple accounts with 1 location each
      // - Multiple accounts with multiple locations each
      // Calculate TOTAL profiles across ALL accounts
      const totalProfileCount = businessAccounts.reduce((total, account) => {
        return total + (account.locations?.length || 0);
      }, 0);

      console.log('[Profile Count] Total profiles across all accounts:', totalProfileCount);
      console.log('[Profile Count] Breakdown:', businessAccounts.map(acc => ({
        account: acc.name,
        locations: acc.locations?.length || 0
      })));

      // Send ONE update with total count (not individual updates per account)
      // Use first account's ID as reference, but include email for lookup
      if (totalProfileCount > 0 && businessAccounts.length > 0 && currentUser?.email) {
        const firstAccountId = businessAccounts[0].accountId;
        console.log('[Profile Count] Updating subscription with total count:', totalProfileCount);
        await updateProfileCount(firstAccountId, totalProfileCount);
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

      // Check if this is a REAUTH_REQUIRED error
      if (error instanceof Error && error.message.startsWith('REAUTH_REQUIRED')) {
        const reason = error.message.replace('REAUTH_REQUIRED: ', '');
        console.error('[useGoogleBusinessProfile] Re-authentication required:', reason);

        setError(reason);
        setNeedsReauth(true);
        setReauthReason(reason);
        setIsConnected(false);
        setAccounts([]);
        setSelectedAccount(null);
        setSelectedLocation(null);

        toast({
          title: "Reconnection Required",
          description: reason,
          variant: "destructive",
          duration: 10000,
        });

        return; // Exit early
      }

      setError('Failed to load business accounts');
      toast({
        title: "Error loading accounts",
        description: "Failed to load your Google Business Profile accounts. Please try reconnecting.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, saveGbpAssociation, updateProfileCount]);

  // Listen for global reauth events from tokenInvalidationService
  useEffect(() => {
    const unsubscribe = tokenInvalidationService.onReauthRequired((reason) => {
      console.log('[useGoogleBusinessProfile] Global reauth event received:', reason);

      setNeedsReauth(true);
      setReauthReason(reason);
      setIsConnected(false);
      setAccounts([]);
      setSelectedAccount(null);
      setSelectedLocation(null);
      setError(reason);

      toast({
        title: "Reconnection Required",
        description: reason,
        variant: "destructive",
        duration: 10000,
      });
    });

    return unsubscribe;
  }, [toast]);

  // Automatic token refresh - check periodically to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    let refreshInterval: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 3; // Reduced retries to avoid rate limiting

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
          // Retry with exponential backoff (longer delays to avoid rate limits)
          setTimeout(() => performTokenRefresh(), Math.pow(2, retryCount) * 5000);
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

    // Check every 30 minutes (reduced from 10 to avoid rate limiting)
    refreshInterval = setInterval(performTokenRefresh, 30 * 60 * 1000); // 30 minutes

    // Delayed initial check (avoid immediate rate limit hit on page load)
    const initialCheckTimeout = setTimeout(async () => {
      try {
        console.log('🔍 Initial connection check...');

        // If token is expiring soon, refresh
        if (googleBusinessProfileService.isTokenExpired()) {
          console.log('🔄 Token expiring, refreshing...');
          await googleBusinessProfileService.refreshAccessToken();
        }

        console.log('✅ Connection verified');
      } catch (error) {
        console.error('Initial check failed:', error);
        // Try to recover instead of failing
        await performTokenRefresh();
      }
    }, 5000); // Wait 5 seconds before first check

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      clearTimeout(initialCheckTimeout);
    };
  }, [isConnected, toast]);

  // Initialize and check existing connection
  useEffect(() => {
    const currentUserId = currentUser?.uid || null;

    // Skip if already initializing or if user hasn't changed
    if (isInitializing.current || (hasInitialized.current && lastUserId.current === currentUserId)) {
      return; // Silent skip - no logging spam
    }

    const initializeConnection = async () => {
      // Prevent concurrent initializations
      if (isInitializing.current) {
        return; // Silent skip
      }

      isInitializing.current = true;
      setIsLoading(true);

      try {
        // Set the current user ID in the service for Firestore operations
        googleBusinessProfileService.setCurrentUserId(currentUserId);

        // Check if we just reloaded after payment
        const justReloaded = sessionStorage.getItem('post_payment_reload') === 'true';
        if (justReloaded) {
          sessionStorage.removeItem('post_payment_reload');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Load tokens with Firebase user ID
        const hasValidTokens = await googleBusinessProfileService.loadStoredTokens(currentUserId);
        setIsConnected(hasValidTokens);

        if (hasValidTokens) {
          try {
            await loadBusinessAccounts();
          } catch (loadError) {
            if (loadError instanceof Error && loadError.message.includes('Authentication')) {
              setError('Authentication expired. Please reconnect your Google Business Profile.');
              setIsConnected(false);
            }
          }
        }

        // Mark as initialized
        hasInitialized.current = true;
        lastUserId.current = currentUserId;
      } catch (error) {
        setError('Failed to initialize connection');
      } finally {
        setIsLoading(false);
        isInitializing.current = false;
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
    // Only re-initialize if the user ID actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Refresh accounts (with optional force refresh to bypass cache)
  const refreshAccounts = useCallback(async (forceRefresh: boolean = false) => {
    if (isConnected) {
      await loadBusinessAccounts(forceRefresh);
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
    needsReauth,
    reauthReason,
    connectGoogleBusiness,
    disconnectGoogleBusiness,
    selectAccount,
    selectLocation,
    refreshAccounts,
    handleOAuthCallback,
  };
};


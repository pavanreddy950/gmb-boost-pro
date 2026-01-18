import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useGoogleBusinessProfile } from '@/hooks/useGoogleBusinessProfile';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionService';
import { useToast } from '@/hooks/use-toast';

interface Subscription {
  id: string;
  email: string;
  status: string;
  profileCount: number;
  trialEndDate?: string;
  subscriptionEndDate?: string;
  subscriptionStartDate?: string;
  isAdmin?: boolean;
  // New billing info
  paidSlots?: number;           // How many profiles user paid for
  connectedProfiles?: number;   // How many profiles are actually connected
  availableSlots?: number;      // paidSlots - connectedProfiles
  needsMoreSlots?: boolean;     // connectedProfiles > paidSlots
  amountPaid?: number;          // Total amount paid in paise
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  isLoading: boolean;
  status: 'trial' | 'active' | 'expired' | 'none' | 'admin';
  daysRemaining: number | null;
  plans: typeof SUBSCRIPTION_PLANS;
  checkSubscriptionStatus: () => Promise<void>;
  createTrialSubscription: () => Promise<void>;
  upgradeToPaid: (planId: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  isFeatureBlocked: boolean;
  canUsePlatform: boolean;
  requiresPayment: boolean;
  billingOnly: boolean;
  message: string | null;
  showTrialSetup: boolean;
  setShowTrialSetup: (show: boolean) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'trial' | 'active' | 'expired' | 'none' | 'admin'>('none');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isFeatureBlocked, setIsFeatureBlocked] = useState(false);
  const [canUsePlatform, setCanUsePlatform] = useState(true);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [billingOnly, setBillingOnly] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showTrialSetup, setShowTrialSetup] = useState(false);

  const { currentUser } = useAuth();
  const { accounts } = useGoogleBusinessProfile();
  const { toast } = useToast();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';

  // Use email as the primary identifier
  const userEmail = currentUser?.email;
  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  console.log('SubscriptionContext - Email:', userEmail);

  const checkSubscriptionStatus = async () => {
    if (!userEmail) {
      console.log('No user email, setting status to none');
      setStatus('none');
      setDaysRemaining(null);
      setIsFeatureBlocked(false);
      setIsLoading(false);
      return;
    }

    console.log('Checking subscription status for email:', userEmail);

    try {
      setIsLoading(true);

      // Use the new user-payment endpoint with email
      const response = await fetch(`${backendUrl}/api/user-payment/status?email=${encodeURIComponent(userEmail)}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Subscription status from backend:', data);

        // Handle admin status
        if (data.status === 'admin') {
          console.log('Admin user detected, granting unlimited access');
          setStatus('admin');
          setDaysRemaining(999999);
          setSubscription({
            id: userEmail,
            email: userEmail,
            status: 'admin',
            profileCount: 999999,
            isAdmin: true
          });
          setCanUsePlatform(true);
          setRequiresPayment(false);
          setBillingOnly(false);
          setIsFeatureBlocked(false);
          setMessage('Administrator - Unlimited Access');
          setIsLoading(false);
          return;
        }

        // If no subscription exists, AUTO-START 15-day trial silently
        // IMPORTANT: Only do this for genuinely new users, not for existing users with errors
        if (data.status === 'none' && data.message === 'No user found') {
          console.log('New user detected, auto-starting 15-day trial silently...');

          try {
            const trialResponse = await fetch(`${backendUrl}/api/user-payment/trial`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                userId: currentUser?.uid,
                displayName: displayName
              })
            });

            if (trialResponse.ok) {
              const trialData = await trialResponse.json();
              console.log('✅ Trial started silently:', trialData);

              setSubscription({
                id: userEmail,
                email: userEmail,
                status: 'trial',
                profileCount: 0,
                trialEndDate: trialData.subscription?.trialEndDate
              });
              setStatus('trial');
              setDaysRemaining(15);
              setIsFeatureBlocked(false);
              setCanUsePlatform(true);
              setRequiresPayment(false);
              setBillingOnly(false);
              setMessage(null);

              toast({
                title: "Welcome! 🎉",
                description: "Your 15-day free trial has started. Enjoy all features!",
              });
            } else {
              console.error('Failed to auto-start trial');
              setStatus('none');
            }
          } catch (trialError) {
            console.error('Error auto-starting trial:', trialError);
            setStatus('none');
          }

          setIsLoading(false);
          return;
        }

        // Set subscription data from response (including new billing info)
        setStatus(data.status as 'trial' | 'active' | 'expired' | 'none');
        setDaysRemaining(data.daysRemaining || null);
        setSubscription({
          id: userEmail,
          email: userEmail,
          status: data.status,
          profileCount: data.profileCount || 0,
          trialEndDate: data.trialEndDate,
          subscriptionEndDate: data.subscriptionEndDate,
          subscriptionStartDate: data.subscriptionStartDate,
          // New billing info from backend
          paidSlots: data.paidSlots || 0,
          connectedProfiles: data.connectedProfiles || 0,
          availableSlots: data.availableSlots || 0,
          needsMoreSlots: data.needsMoreSlots || false,
          amountPaid: data.amountPaid || 0
        });

        // Set platform access based on subscription status
        setCanUsePlatform(data.canUsePlatform !== false);
        setRequiresPayment(data.requiresPayment === true);
        setBillingOnly(data.billingOnly === true);
        setMessage(data.message || null);

        // Block features if expired
        setIsFeatureBlocked(data.status === 'expired' || data.billingOnly === true);

        // Show warning if trial is ending soon
        if (data.status === 'trial' && data.daysRemaining && data.daysRemaining <= 3) {
          toast({
            title: "Trial Ending Soon",
            description: `Your trial ends in ${data.daysRemaining} day(s). Upgrade now to continue using all features.`,
            variant: "default"
          });
        }

        // Show error if trial expired
        if (data.status === 'expired' && data.billingOnly) {
          toast({
            title: "Trial Expired",
            description: "Your 15-day trial has expired. Please upgrade to continue using all features.",
            variant: "destructive"
          });
        }
      } else {
        console.error('Failed to check subscription status');
        setStatus('none');
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setStatus('none');
    } finally {
      setIsLoading(false);
    }
  };

  const createTrialSubscription = async () => {
    if (!userEmail) {
      toast({
        title: "Error",
        description: "Please sign in first",
        variant: "destructive"
      });
      return;
    }

    console.log('Creating trial subscription for email:', userEmail);

    try {
      setIsLoading(true);

      const response = await fetch(`${backendUrl}/api/user-payment/trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userEmail,
          userId: currentUser?.uid,
          displayName: displayName
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription({
          id: userEmail,
          email: userEmail,
          status: 'trial',
          profileCount: 0,
          trialEndDate: data.subscription?.trialEndDate
        });
        setStatus('trial');
        setDaysRemaining(15);
        setIsFeatureBlocked(false);

        toast({
          title: "Trial Started!",
          description: "Your 15-day free trial has begun. Enjoy all features!",
        });
      } else {
        throw new Error('Failed to create trial');
      }

      await checkSubscriptionStatus();
    } catch (error) {
      console.error('Error creating trial subscription:', error);
      toast({
        title: "Error",
        description: "Failed to start trial. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeToPaid = async (planId: string) => {
    // This will be handled by the PaymentModal component
    console.log('Upgrading to plan:', planId);
  };

  const cancelSubscription = async () => {
    if (!subscription || !userEmail) return;

    try {
      setIsLoading(true);

      // For now, just refresh the subscription status
      // Cancel functionality can be added to userPayment routes later
      toast({
        title: "Info",
        description: "Please contact support to cancel your subscription.",
      });

      await checkSubscriptionStatus();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check subscription status when user email changes
  useEffect(() => {
    console.log('SubscriptionContext useEffect - email changed:', userEmail);

    // Delay subscription check if we just completed payment
    const justReloaded = sessionStorage.getItem('post_payment_reload') === 'true';
    const delay = justReloaded ? 3000 : 0;

    const timeoutId = setTimeout(() => {
      if (userEmail) {
        checkSubscriptionStatus();
      } else {
        console.log('No user email, resetting subscription state');
        setStatus('none');
        setDaysRemaining(null);
        setSubscription(null);
        setIsFeatureBlocked(false);
        setIsLoading(false);
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [userEmail]);

  // Auto-check subscription status every 30 minutes
  useEffect(() => {
    if (!userEmail) return;

    const interval = setInterval(() => {
      checkSubscriptionStatus();
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [userEmail]);

  const value: SubscriptionContextType = {
    subscription,
    isLoading,
    status,
    daysRemaining,
    plans: SUBSCRIPTION_PLANS,
    checkSubscriptionStatus,
    createTrialSubscription,
    upgradeToPaid,
    cancelSubscription,
    isFeatureBlocked,
    canUsePlatform,
    requiresPayment,
    billingOnly,
    message,
    showTrialSetup,
    setShowTrialSetup
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Loader2, AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isLoading,
    status,
    billingOnly,
    requiresPayment,
    canUsePlatform,
    daysRemaining,
    message
  } = useSubscription();

  // Always allow access to billing-related pages
  const isBillingPage = location.pathname.includes('/billing') ||
                        location.pathname.includes('/upgrade');

  // Determine if user should be blocked from non-billing pages
  const shouldBlockAccess = !isBillingPage && (
    status === 'expired' ||
    billingOnly === true ||
    canUsePlatform === false ||
    requiresPayment === true
  );

  // Admin users bypass all checks
  const isAdmin = status === 'admin';

  // Active trial or subscription users have full access
  const hasValidSubscription = status === 'trial' || status === 'active';

  // Auto-redirect expired users to billing page
  useEffect(() => {
    if (!isLoading && shouldBlockAccess && !isAdmin) {
      console.log('[SubscriptionGuard] Blocking access - redirecting to billing');
      console.log('[SubscriptionGuard] Status:', status, 'billingOnly:', billingOnly, 'canUsePlatform:', canUsePlatform);
      navigate('/dashboard/billing', { replace: true });
    }
  }, [isLoading, shouldBlockAccess, isAdmin, navigate, status, billingOnly, canUsePlatform]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking subscription status...</p>
        </div>
      </div>
    );
  }

  // If on billing page, always allow access
  if (isBillingPage) {
    return <>{children}</>;
  }

  // Admin users have full access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Active subscription or trial users have full access
  if (hasValidSubscription) {
    return <>{children}</>;
  }

  // For expired/blocked users not on billing page, show blocking screen
  // (This is a fallback in case redirect doesn't happen immediately)
  if (shouldBlockAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center p-8 bg-card rounded-lg border shadow-lg">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>

          <h2 className="text-2xl font-bold mb-2">
            {status === 'expired' ? 'Trial Expired' : 'Subscription Required'}
          </h2>

          <p className="text-muted-foreground mb-6">
            {message || 'Your trial period has ended. Please upgrade to continue using all features.'}
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/dashboard/billing')}
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Go to Billing
            </Button>

            <p className="text-xs text-muted-foreground">
              Upgrade now to unlock all features and continue growing your business
            </p>
          </div>
        </div>
      </div>
    );
  }

  // All good, render children
  return <>{children}</>;
};

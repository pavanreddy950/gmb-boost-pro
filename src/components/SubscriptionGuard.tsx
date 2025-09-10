import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PaymentWall } from '@/components/PaymentWall';
import { UpgradeModal } from '@/components/UpgradeModal';
import { Loader2 } from 'lucide-react';

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

  // Always allow access to billing page
  const isBillingPage = location.pathname.includes('/billing') || 
                        location.pathname.includes('/upgrade');

  // Remove auto-redirect to prevent navigation issues
  // Users can manually navigate via the modal button

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If on billing page, always allow access without modal
  if (isBillingPage) {
    return <>{children}</>;
  }

  // Show modal for expired trials or payment required (but still render the page)
  const showUpgradeModal = (status === 'expired' && requiresPayment) || 
                           billingOnly === true || 
                           canUsePlatform === false;

  // For non-billing pages, show the page content with upgrade modal overlay
  if (showUpgradeModal) {
    return (
      <>
        {/* Render the actual page content */}
        {children}
        
        {/* Show upgrade modal on top */}
        <UpgradeModal 
          isOpen={true}
          status={status}
          daysRemaining={daysRemaining || 0}
        />
      </>
    );
  }

  // Trial warning - show warning but allow access
  if (status === 'trial' && daysRemaining !== null && daysRemaining <= 1 && daysRemaining > 0) { // TEST MODE: 1 minute warning
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-40 bg-orange-500 text-white py-2 px-4 text-center">
          <p className="text-sm font-medium">
            ⚠️ Your trial expires in {daysRemaining} minute(s). {/* TEST MODE */} 
            <button 
              onClick={() => navigate('/dashboard/billing')}
              className="ml-2 underline hover:no-underline"
            >
              Upgrade now to avoid interruption
            </button>
          </p>
        </div>
        <div className="pt-10">
          {children}
        </div>
      </>
    );
  }

  // All good, render children
  return <>{children}</>;
};
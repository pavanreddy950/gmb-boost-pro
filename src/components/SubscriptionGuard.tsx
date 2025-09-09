import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PaymentWall } from '@/components/PaymentWall';
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

  useEffect(() => {
    // If subscription requires payment and not on billing page, redirect
    if (!isLoading && billingOnly && !isBillingPage) {
      console.log('SubscriptionGuard: Redirecting to billing - billingOnly mode active');
      navigate('/dashboard/billing');
    }
  }, [billingOnly, isBillingPage, isLoading, navigate]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If on billing page, always allow access
  if (isBillingPage) {
    return <>{children}</>;
  }

  // If trial expired and payment required, show payment wall
  if (status === 'expired' && requiresPayment) {
    return (
      <PaymentWall 
        message={message || "Your 15-day trial has expired. Please upgrade to continue."}
        isExpired={true}
        daysRemaining={0}
      />
    );
  }

  // If billing only mode (can't use platform except billing)
  if (billingOnly === true) {
    return (
      <PaymentWall 
        message={message || "Please complete your payment to access all features."}
        isExpired={true}
        daysRemaining={0}
      />
    );
  }

  // If cannot use platform for any reason
  if (canUsePlatform === false && !isBillingPage) {
    return (
      <PaymentWall 
        message={message || "Your subscription needs attention. Please upgrade to continue."}
        isExpired={true}
        daysRemaining={daysRemaining || 0}
      />
    );
  }

  // Trial warning - show warning but allow access
  if (status === 'trial' && daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-40 bg-orange-500 text-white py-2 px-4 text-center">
          <p className="text-sm font-medium">
            ⚠️ Your trial expires in {daysRemaining} days. 
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
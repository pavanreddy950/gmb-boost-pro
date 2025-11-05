import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { MandateSetup } from './MandateSetup';

export const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { checkSubscriptionStatus, subscription } = useSubscription();
  const [showMandateSetup, setShowMandateSetup] = useState(false);
  const [redirectTimer, setRedirectTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Refresh subscription status
    checkSubscriptionStatus();

    // Show mandate setup modal after 2 seconds for yearly plan users
    const mandateTimer = setTimeout(() => {
      // Check if user purchased a yearly plan (₹99)
      if (subscription?.planId?.includes('yearly')) {
        console.log('[Payment Success] Showing mandate setup for yearly plan user');
        setShowMandateSetup(true);
      } else {
        // If not yearly plan, redirect to dashboard after 3 seconds
        const timer = setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
        setRedirectTimer(timer);
      }
    }, 2000);

    return () => {
      clearTimeout(mandateTimer);
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [navigate, checkSubscriptionStatus, subscription?.planId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto animate-pulse" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Payment Successful!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Thank you for your subscription. Your account has been successfully upgraded.
        </p>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">
            ✨ All premium features are now unlocked
          </p>
        </div>
        
        <p className="text-sm text-gray-500">
          Redirecting to dashboard in 3 seconds...
        </p>
        
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Go to Dashboard Now
        </button>
      </div>

      {/* Mandate Setup Modal for Yearly Plan Users */}
      <MandateSetup
        isOpen={showMandateSetup}
        onClose={() => {
          setShowMandateSetup(false);
          navigate('/dashboard');
        }}
        onSuccess={() => {
          setShowMandateSetup(false);
          navigate('/dashboard');
        }}
      />
    </div>
  );
};
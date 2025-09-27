import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

export const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { checkSubscriptionStatus } = useSubscription();

  useEffect(() => {
    // Refresh subscription status
    checkSubscriptionStatus();
    
    // Redirect to dashboard after 3 seconds
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, checkSubscriptionStatus]);

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
    </div>
  );
};
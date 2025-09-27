import React, { useState } from 'react';
import { useRazorpay, RazorpayOrderOptions } from 'react-razorpay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Shield, Zap, Gift, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface TrialSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  gbpAccountId: string;
  profileCount?: number;
}

export const TrialSetupModal: React.FC<TrialSetupModalProps> = ({
  isOpen,
  onClose,
  gbpAccountId,
  profileCount = 1
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [skipTrial, setSkipTrial] = useState(false);

  const { Razorpay } = useRazorpay();
  const { currentUser } = useAuth();
  const { checkSubscriptionStatus } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_example';

  const handleTrialWithPayment = async () => {
    if (!currentUser || !gbpAccountId) {
      toast({
        title: "Error",
        description: "User authentication or GBP connection required",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // First create a trial subscription
      const trialResponse = await fetch(`${backendUrl}/api/payment/subscription/trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          gbpAccountId,
          email: currentUser.email
        })
      });

      if (!trialResponse.ok) {
        throw new Error('Failed to create trial subscription');
      }

      const trialData = await trialResponse.json();
      console.log('Trial created:', trialData);

      // Create a ₹1 order for payment method setup (required by Razorpay)
      const orderResponse = await fetch(`${backendUrl}/api/payment/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: 1, // ₹1 for payment method setup
          currency: 'INR',
          notes: {
            userId: currentUser.uid,
            email: currentUser.email,
            gbpAccountId,
            profileCount: profileCount,
            setupType: 'trial_with_autopay'
          }
        })
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create trial setup order');
      }

      const { order } = await orderResponse.json();

      // Razorpay checkout for payment method setup
      const options: RazorpayOrderOptions = {
        key: razorpayKeyId,
        amount: order.amount, // $0
        currency: order.currency,
        name: 'GMB Profile Pulse',
        description: '15-Day Free Trial Setup',
        order_id: order.id,
        handler: async (response) => {
          // Verify payment and setup autopay
          const verifyResponse = await fetch(`${backendUrl}/api/payment/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              subscriptionId: trialData.subscription?.id,
              gbpAccountId,
              planId: 'yearly_pro' // Set a default plan for autopay
            })
          });

          if (verifyResponse.ok) {
            onClose();
            await checkSubscriptionStatus();

            toast({
              title: "Free Trial Started! 🎉",
              description: "Your 15-day trial is active with auto-pay setup. Enjoy all features!",
            });

            // Navigate to dashboard
            navigate('/dashboard');
          } else {
            throw new Error('Trial setup verification failed');
          }
        },
        prefill: {
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          contact: ''
        },
        theme: {
          color: '#1E2DCD'
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          }
        },
        notes: {
          trial_setup: 'true',
          auto_pay_enabled: 'true'
        }
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.open();

    } catch (error) {
      console.error('Trial setup error:', error);
      toast({
        title: "Setup Failed",
        description: "There was an error setting up your trial. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipTrial = async () => {
    if (!currentUser || !gbpAccountId) {
      toast({
        title: "Error",
        description: "User authentication or GBP connection required",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Create a simple trial subscription without payment setup
      const trialResponse = await fetch(`${backendUrl}/api/payment/subscription/trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          gbpAccountId,
          email: currentUser.email
        })
      });

      if (trialResponse.ok) {
        onClose();
        await checkSubscriptionStatus();

        toast({
          title: "Free Trial Started! 🎉",
          description: "Your 15-day trial is now active. Add payment details later in billing settings.",
        });

        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        throw new Error('Failed to create trial subscription');
      }
    } catch (error) {
      console.error('Trial creation error:', error);
      toast({
        title: "Error",
        description: "Failed to start trial. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={!isProcessing ? onClose : undefined}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Gift className="h-6 w-6 text-green-600" />
            <span>Claim Your Free 15-Day Trial</span>
          </DialogTitle>
          <DialogDescription>
            Start managing your Google Business Profile with all premium features included!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trial Benefits */}
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-lg text-green-800">What's Included in Your Trial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Auto-Post Scheduling',
                  'Review Management & Auto-Reply',
                  'Performance Analytics',
                  'Advanced Analytics',
                  'API Access',
                  'Priority Support'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pricing Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">After Trial: Simple Per-Profile Pricing</h3>
            </div>
            <p className="text-sm text-blue-800 mb-2">
              Just $99/year per Google Business Profile you want to manage.
            </p>
            <p className="text-xs text-blue-600">
              {profileCount} profile detected → ${profileCount * 99}/year after trial
            </p>
          </div>

          {/* Auto-Pay Setup */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-5 w-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-900">Secure Auto-Pay Setup</h3>
            </div>
            <p className="text-sm text-yellow-800 mb-2">
              We'll securely save your payment method for seamless continuation after your trial.
            </p>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• No charges during your 15-day trial</li>
              <li>• Cancel anytime during the trial</li>
              <li>• Automatic billing only starts after trial ends</li>
              <li>• Industry-standard security with Razorpay</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            <Button
              onClick={handleTrialWithPayment}
              disabled={isProcessing}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
              size="lg"
            >
              {isProcessing ? (
                <>Setting up trial...</>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Start Free Trial with Auto-Pay
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleSkipTrial}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? 'Starting trial...' : 'Start Free Trial (Setup Payment Later)'}
            </Button>
          </div>

          {/* Security Note */}
          <p className="text-xs text-gray-500 text-center">
            🔒 Your payment information is encrypted and secure. Powered by Razorpay.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
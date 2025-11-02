import React, { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CreditCard, CheckCircle, Info, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';

interface MandateSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const MandateSetup: React.FC<MandateSetupProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [mandateAuthorized, setMandateAuthorized] = useState(false);

  const { Razorpay } = useRazorpay();
  const { currentUser } = useAuth();
  const { subscription } = useSubscription();
  const { toast } = useToast();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_RaLWJLkG5dQTII';

  // Check mandate status on mount
  useEffect(() => {
    if (isOpen && (subscription?.gbpAccountId || currentUser?.uid)) {
      checkMandateStatus();
    }
  }, [isOpen, subscription?.gbpAccountId, currentUser?.uid]);

  const checkMandateStatus = async () => {
    if (!currentUser) return;

    // Use GBP account ID if available, otherwise use user ID
    const accountId = subscription?.gbpAccountId || currentUser.uid;

    try {
      console.log('[MandateSetup] Checking mandate status for:', accountId);
      const response = await fetch(`${backendUrl}/api/payment/mandate/status/${accountId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[MandateSetup] Mandate status:', data);
        setMandateAuthorized(data.mandateAuthorized || false);
        setCustomerId(data.razorpayCustomerId || null);
      }
    } catch (error) {
      console.error('[MandateSetup] Error checking mandate status:', error);
    }
  };

  const handleSetupMandate = async () => {
    console.log('[MandateSetup] Starting mandate setup...', {
      hasCurrentUser: !!currentUser,
      hasSubscription: !!subscription,
      gbpAccountId: subscription?.gbpAccountId
    });

    if (!currentUser) {
      toast({
        title: "Error",
        description: "Please log in first",
        variant: "destructive"
      });
      return;
    }

    // Use user ID as fallback if no GBP account yet (for new users)
    const accountId = subscription?.gbpAccountId || currentUser.uid;

    if (!Razorpay) {
      toast({
        title: "Error",
        description: "Payment system is not loaded. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      let currentCustomerId = customerId;

      // Step 1: Create customer if not exists
      if (!currentCustomerId) {
        toast({
          title: "Setting up auto-payments",
          description: "Creating your payment profile...",
        });

        console.log('[MandateSetup] Creating customer with data:', {
          userId: currentUser.uid,
          email: currentUser.email,
          gbpAccountId: accountId
        });

        const setupResponse = await fetch(`${backendUrl}/api/payment/mandate/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.uid,
            email: currentUser.email,
            name: currentUser.displayName || currentUser.email,
            contact: currentUser.phoneNumber || '',
            gbpAccountId: accountId
          })
        });

        if (!setupResponse.ok) {
          const errorData = await setupResponse.json().catch(() => ({}));
          console.error('[MandateSetup] Setup failed:', errorData);
          throw new Error(errorData.details || errorData.error || 'Failed to setup mandate');
        }

        const setupData = await setupResponse.json();
        console.log('[MandateSetup] Customer created:', setupData);

        // Check if mandate is already authorized
        if (setupData.alreadyAuthorized) {
          console.log('[MandateSetup] ✅ Mandate already authorized, no action needed');
          toast({
            title: "Already Set Up",
            description: "Your payment method is already authorized. No action needed.",
          });
          setIsProcessing(false);
          onSuccess();
          return;
        }

        currentCustomerId = setupData.customerId;
        setCustomerId(currentCustomerId);
      }

      // Step 2: Create authorization order (₹2 for mandate setup)
      toast({
        title: "Payment Authorization",
        description: "Creating authorization request...",
      });

      const orderResponse = await fetch(`${backendUrl}/api/payment/mandate/create-auth-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentCustomerId,
          amount: 200, // ₹2 for mandate authorization
          currency: 'INR',
          userId: currentUser.uid,
          gbpAccountId: accountId
        })
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json().catch(() => ({}));
        console.error('[MandateSetup] Order creation failed:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to create authorization order');
      }

      const { order } = await orderResponse.json();
      console.log('[MandateSetup] Authorization order created:', order.id);

      // Step 3: Open Razorpay for mandate authorization
      const options: RazorpayOrderOptions = {
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'LOBAISEO',
        description: 'Auto-payment setup - You will be charged ₹2 for authorization',
        order_id: order.id,
        recurring: '1', // Enable recurring payments
        handler: async (response) => {
          try {
            console.log('[MandateSetup] Payment successful, verifying...');
            // Step 4: Verify mandate authorization
            const verifyResponse = await fetch(`${backendUrl}/api/payment/mandate/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                customerId: currentCustomerId,
                gbpAccountId: accountId
              })
            });

            if (verifyResponse.ok) {
              setMandateAuthorized(true);
              toast({
                title: "Success!",
                description: "Auto-payment has been set up successfully",
              });
              if (onSuccess) onSuccess();
              setTimeout(() => onClose(), 2000);
            } else {
              throw new Error('Mandate verification failed');
            }
          } catch (error) {
            console.error('Mandate verification error:', error);
            toast({
              title: "Verification Error",
              description: "Failed to verify mandate authorization. Please try again.",
              variant: "destructive"
            });
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          contact: currentUser.phoneNumber || ''
        },
        notes: {
          purpose: 'mandate_authorization'
        },
        theme: {
          color: '#1E2DCD'
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast({
              title: "Authorization Cancelled",
              description: "You can set up auto-payment later from billing settings.",
            });
          }
        }
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.on('payment.failed', (response) => {
        console.error('Payment failed:', response.error);
        setIsProcessing(false);
        toast({
          title: "Authorization Failed",
          description: response.error.description || "Unable to authorize payment method",
          variant: "destructive"
        });
      });

      razorpayInstance.open();

    } catch (error) {
      console.error('Mandate setup error:', error);
      toast({
        title: "Setup Error",
        description: "Failed to set up auto-payment. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  if (mandateAuthorized) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center">Auto-Payment Active</DialogTitle>
            <DialogDescription className="text-center">
              Your auto-payment is already set up and active
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <Info className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                We'll automatically charge your payment method when your subscription renews.
              </AlertDescription>
            </Alert>

            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center">Authorize Payment to Start Trial</DialogTitle>
          <DialogDescription className="text-center">
            Set up payment method to activate your free trial. You won't be charged until the trial ends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">What Happens Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span><strong>Step 1:</strong> Authorize payment method (₹2 charge, refunded in 5-7 days)</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span><strong>Step 2:</strong> Free trial starts immediately</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span><strong>Step 3:</strong> Access all premium features during trial</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span><strong>Step 4:</strong> Automatic billing after trial ends (cancel anytime)</span>
              </div>
            </CardContent>
          </Card>

          {/* Authorization Info */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              You'll be charged ₹2 to authorize your payment method. This amount will be refunded within 5-7 business days.
            </AlertDescription>
          </Alert>

          {/* Security Badge */}
          <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Secured by Razorpay | PCI DSS Compliant</span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2">
            <Button
              onClick={handleSetupMandate}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Authorize Payment Method & Start Trial
                </>
              )}
            </Button>
          </div>

          {/* Required Notice */}
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-xs">
              <strong>Payment authorization is required</strong> to start your free trial. You won't be charged until the trial ends.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
};

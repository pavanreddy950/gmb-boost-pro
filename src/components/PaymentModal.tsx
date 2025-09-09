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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Check, CreditCard, Shield, Zap, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlanId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  defaultPlanId = 'monthly_basic'
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlanId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDetails, setCouponDetails] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  
  const { Razorpay } = useRazorpay();
  const { currentUser } = useAuth();
  const { subscription } = useSubscription();
  const { toast } = useToast();
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net';
  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_example';

  const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);
  
  const validateCoupon = async () => {
    if (!couponCode || !selectedPlan) return;
    
    setIsValidatingCoupon(true);
    try {
      const response = await fetch(`${backendUrl}/api/payment/coupon/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode,
          amount: selectedPlan.amount
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCouponDetails(result);
        toast({
          title: "Coupon Applied!",
          description: `${result.description} - You save ₹${result.discountAmount}`,
        });
      } else {
        setCouponDetails(null);
        toast({
          title: "Invalid Coupon",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      toast({
        title: "Error",
        description: "Failed to validate coupon",
        variant: "destructive"
      });
    } finally {
      setIsValidatingCoupon(false);
    }
  };
  
  const getFinalAmount = () => {
    if (couponDetails && couponDetails.success) {
      return couponDetails.finalAmount;
    }
    return selectedPlan?.amount || 0;
  };

  const handlePayment = async () => {
    if (!currentUser || !selectedPlan) {
      toast({
        title: "Error",
        description: "Please select a plan and ensure you're logged in",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Create order in backend
      const orderResponse = await fetch(`${backendUrl}/api/payment/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: selectedPlan.amount,
          currency: selectedPlan.currency,
          couponCode: couponDetails?.success ? couponCode : undefined,
          notes: {
            planId: selectedPlan.id,
            userId: currentUser.uid,
            email: currentUser.email,
            gbpAccountId: subscription?.gbpAccountId
          }
        })
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const { order, finalAmount } = await orderResponse.json();

      // Razorpay checkout options
      const options: RazorpayOrderOptions = {
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'GMP Boost Pro',
        description: selectedPlan.name,
        order_id: order.id,
        handler: async (response) => {
          // Verify payment on backend
          const verifyResponse = await fetch(`${backendUrl}/api/payment/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              subscriptionId: subscription?.id,
              gbpAccountId: subscription?.gbpAccountId,
              planId: selectedPlan.id
            })
          });

          if (verifyResponse.ok) {
            toast({
              title: "Payment Successful!",
              description: "Your subscription has been activated.",
            });
            onClose();
            // Reload to update subscription status
            window.location.reload();
          } else {
            throw new Error('Payment verification failed');
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
            toast({
              title: "Payment Cancelled",
              description: "Your payment was cancelled.",
              variant: "default"
            });
          }
        }
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.open();
      
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
          <DialogTitle>Choose Your Plan</DialogTitle>
          <DialogDescription>
            Select a plan that best fits your needs. All plans include a 15-day free trial.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <RadioGroup
            value={selectedPlanId}
            onValueChange={setSelectedPlanId}
            className="space-y-4"
          >
            {SUBSCRIPTION_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all relative ${
                  selectedPlanId === plan.id
                    ? 'border-primary ring-2 ring-primary ring-opacity-20'
                    : plan.popular
                    ? 'border-primary/50 hover:border-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      MOST POPULAR
                    </div>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value={plan.id} />
                      <div>
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <CardDescription className="mt-1">
                          ₹{plan.amount}/
                          {plan.interval === 'monthly' ? 'month' : 'year'}
                        </CardDescription>
                      </div>
                    </div>
                    {plan.interval === 'yearly' && (
                      <div className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm font-medium">
                        Save 17%
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>

          <div className="mt-6 space-y-4">
            {/* Coupon Code Section */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Tag className="h-5 w-5 text-purple-600" />
                  <p className="text-sm font-medium text-purple-900">Have a coupon code?</p>
                </div>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1"
                    disabled={isValidatingCoupon}
                  />
                  <Button
                    onClick={validateCoupon}
                    disabled={!couponCode || isValidatingCoupon || !selectedPlan}
                    variant="outline"
                    size="sm"
                  >
                    {isValidatingCoupon ? 'Validating...' : 'Apply'}
                  </Button>
                </div>
                {couponDetails && couponDetails.success && (
                  <div className="bg-green-100 rounded-md p-2">
                    <p className="text-sm text-green-800">
                      ✓ {couponDetails.description} - You save ₹{couponDetails.discountAmount}!
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Secure Payment
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Your payment information is encrypted and secure. We use Razorpay for processing payments.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Zap className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Instant Activation
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Your subscription will be activated immediately after payment confirmation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-background flex items-center justify-between mt-6 pt-6 border-t">
            <div>
              {couponDetails && couponDetails.success ? (
                <div>
                  <p className="text-sm text-gray-500 line-through">₹{selectedPlan?.amount}</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₹{getFinalAmount()}
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      /{selectedPlan?.interval === 'monthly' ? 'month' : 'year'}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-2xl font-bold">
                  ₹{selectedPlan?.amount}
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    /{selectedPlan?.interval === 'monthly' ? 'month' : 'year'}
                  </span>
                </p>
              )}
              <p className="text-sm text-gray-500">
                Plus applicable taxes
              </p>
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                disabled={isProcessing}
                className="min-w-[120px] bg-primary hover:bg-primary/90"
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
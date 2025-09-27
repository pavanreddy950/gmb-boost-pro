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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Check, CreditCard, Shield, Zap, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useGoogleBusinessProfileContext } from '@/contexts/GoogleBusinessProfileContext';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_PLANS, SubscriptionService } from '@/lib/subscriptionService';
import { useNavigate } from 'react-router-dom';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlanId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  defaultPlanId = 'per_profile_yearly'
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlanId);
  const [profileCount, setProfileCount] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDetails, setCouponDetails] = useState<{
    success: boolean;
    finalAmount: number;
    discountAmount: number;
    description: string;
    error?: string;
  } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const { Razorpay } = useRazorpay();
  const { currentUser } = useAuth();
  const { subscription, checkSubscriptionStatus } = useSubscription();
  const { accounts, locations } = useGoogleBusinessProfileContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_example';

  const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);

  // Calculate total accounts based on connected GBP accounts and their locations
  const totalConnectedProfiles = accounts?.reduce((total, account) => {
    return total + (account.locations?.length || 0);
  }, 0) || 0;

  // Auto-set profile count to current connected profiles when per-profile plan is selected
  useEffect(() => {
    if (selectedPlanId === 'per_profile_yearly' && totalConnectedProfiles > 0) {
      setProfileCount(Math.max(1, totalConnectedProfiles));
    }
  }, [selectedPlanId, totalConnectedProfiles]);
  
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
          description: `${result.description} - You save $${(result.discountAmount / 100).toFixed(2)}`,
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
    const baseAmount = selectedPlanId === 'per_profile_yearly'
      ? SubscriptionService.calculateTotalPrice(profileCount)
      : selectedPlan?.amount || 0;

    if (couponDetails && couponDetails.success) {
      return couponDetails.finalAmount;
    }
    return baseAmount;
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
          amount: selectedPlanId === 'per_profile_yearly'
            ? SubscriptionService.calculateTotalPrice(profileCount)
            : selectedPlan.amount,
          currency: selectedPlan.currency,
          couponCode: couponDetails?.success ? couponCode : undefined,
          notes: {
            planId: selectedPlan.id,
            profileCount: selectedPlanId === 'per_profile_yearly' ? profileCount : undefined,
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
        name: 'LOBAISEO',
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
            // Close modal first
            onClose();
            
            // Refresh subscription status
            await checkSubscriptionStatus();
            
            // Navigate to payment success page
            navigate('/payment-success');
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
          <DialogTitle>Upgrade Your Profile Access</DialogTitle>
          <DialogDescription>
            Choose how many Google Business Profiles you want to manage. Pay only for what you need at $99 per profile per year.
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
                          {plan.id === 'per_profile_yearly'
                            ? `$${(SubscriptionService.calculateTotalPrice(profileCount) / 100).toFixed(0)}/year`
                            : `${(plan.amount / 100).toFixed(0)}/${plan.interval === 'monthly' ? 'month' : 'year'}`
                          }
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

          {/* Profile Count Selector for Per-Profile Plan */}
          {selectedPlanId === 'per_profile_yearly' && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium text-gray-900">How many profiles do you want to manage?</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="profile-count" className="text-sm">Profiles:</Label>
                    <Input
                      id="profile-count"
                      type="number"
                      min="1"
                      max="50"
                      value={profileCount}
                      onChange={(e) => setProfileCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20"
                    />
                  </div>
                  <div className="text-sm text-gray-600">
                    × $99/year = <span className="font-semibold text-green-600">
                      ${(SubscriptionService.calculateTotalPrice(profileCount) / 100).toFixed(0)}/year
                    </span>
                  </div>
                </div>
                {totalConnectedProfiles > 0 && (
                  <p className="text-xs text-blue-600">
                    💡 You currently have {totalConnectedProfiles} profile{totalConnectedProfiles > 1 ? 's' : ''} connected
                  </p>
                )}
              </div>
            </div>
          )}

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
                      ✓ {couponDetails.description} - You save ${(couponDetails.discountAmount / 100).toFixed(2)}!
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
                  <p className="text-sm text-gray-500 line-through">
                    {selectedPlanId === 'per_profile_yearly'
                      ? `$${(SubscriptionService.calculateTotalPrice(profileCount) / 100).toFixed(0)}`
                      : `$${(selectedPlan?.amount / 100).toFixed(0)}`
                    }
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    ${(getFinalAmount() / 100).toFixed(0)}
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      /{selectedPlan?.interval === 'monthly' ? 'month' : 'year'}
                    </span>
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-bold">
                    ${(getFinalAmount() / 100).toFixed(0)}
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      /{selectedPlan?.interval === 'monthly' ? 'month' : 'year'}
                    </span>
                  </p>
                  {selectedPlanId === 'per_profile_yearly' && (
                    <p className="text-sm text-gray-600">
                      {profileCount} profile{profileCount > 1 ? 's' : ''} × $99/year
                    </p>
                  )}
                </div>
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
                className="min-w-[140px] bg-primary hover:bg-primary/90"
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Upgrade Profiles
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
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
import { Check, CreditCard, Shield, Zap, Tag, Users } from 'lucide-react';
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
  const [exchangeRate, setExchangeRate] = useState(88.718); // Dynamic exchange rate, default fallback

  const { Razorpay } = useRazorpay();
  const { currentUser } = useAuth();
  const { subscription, checkSubscriptionStatus } = useSubscription();
  const { accounts } = useGoogleBusinessProfileContext();
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

  // Fetch live exchange rate when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchExchangeRate = async () => {
        try {
          console.log('[PaymentModal] 🔄 Fetching live exchange rate...');
          const response = await fetch(`${backendUrl}/api/payment/detect-currency`);

          if (response.ok) {
            const data = await response.json();
            const rate = data.exchangeRate || 88.718;
            setExchangeRate(rate);
            console.log(`[PaymentModal] ✅ Live exchange rate: 1 USD = ${rate} INR`);
          } else {
            console.warn('[PaymentModal] ⚠️ Using fallback rate: 88.718 INR');
          }
        } catch (error) {
          console.error('[PaymentModal] ❌ Error fetching exchange rate:', error);
          console.warn('[PaymentModal] ⚠️ Using fallback rate: 88.718 INR');
        }
      };

      fetchExchangeRate();
    }
  }, [isOpen, backendUrl]);

  // Reset coupon when profile count or plan changes (user needs to re-apply)
  useEffect(() => {
    if (couponDetails) {
      setCouponDetails(null);
    }
  }, [profileCount, selectedPlanId]);
  
  const validateCoupon = async () => {
    if (!couponCode || !selectedPlan) return;
    
    setIsValidatingCoupon(true);
    try {
      // Calculate the actual total amount (including profile count for per-profile plans)
      const actualAmount = selectedPlanId === 'per_profile_yearly'
        ? SubscriptionService.calculateTotalPrice(profileCount)
        : selectedPlan.amount;
      
      const response = await fetch(`${backendUrl}/api/payment/coupon/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode,
          amount: actualAmount, // Pass the actual total amount
          userId: currentUser?.uid // Pass userId for one-time per user validation
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

    if (!Razorpay) {
      toast({
        title: "Error",
        description: "Payment system is not loaded. Please refresh the page and try again.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    // USE SUBSCRIPTION-BASED PAYMENT WITH AUTO-PAY MANDATE
    return handleSubscriptionPayment();
  };

  const handleSubscriptionPayment = async () => {

    try {
      // CRITICAL VALIDATION: Ensure profileCount is valid
      if (!profileCount || profileCount < 1 || isNaN(profileCount)) {
        console.error('[Payment] ❌ CRITICAL: Invalid profileCount:', profileCount);
        toast({
          title: "Profile Count Required",
          description: "Please select how many Google Business Profiles you want to manage.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      console.log('[Payment] ✅ ProfileCount validation passed:', profileCount);

      // Show loading toast
      toast({
        title: "Initializing Payment",
        description: "Please wait while we set up your payment...",
      });

      toast({
        title: "Setting up Subscription",
        description: "Preparing subscription with auto-pay mandate...",
      });

      // Calculate USD amount
      let usdAmount = selectedPlanId === 'per_profile_yearly'
        ? SubscriptionService.calculateTotalPrice(profileCount)
        : selectedPlan.amount;

      // Apply coupon discount if available
      console.log('[Subscription] 🔍 Checking coupon:', { couponDetails, hasCouponDetails: !!couponDetails, finalAmount: couponDetails?.finalAmount });

      if (couponDetails && couponDetails.finalAmount) {
        usdAmount = couponDetails.finalAmount;
        console.log(`[Subscription] 🎟️ Coupon applied: Original $${(selectedPlanId === 'per_profile_yearly' ? SubscriptionService.calculateTotalPrice(profileCount) : selectedPlan.amount) / 100} → Discounted $${usdAmount / 100}`);
      } else {
        console.log('[Subscription] ⚠️ Coupon NOT applied - couponDetails:', couponDetails);
      }

      // Use INR for all payments (Razorpay subscriptions work best with INR)
      const targetCurrency = 'INR';
      const usdInDollars = usdAmount / 100;
      const convertedAmount = Math.round(usdInDollars * exchangeRate); // Convert to INR (whole rupees)

      console.log(`[Subscription] 💱 Amount: $${usdInDollars} USD → ₹${convertedAmount} INR (rate: ${exchangeRate})`);

      // Step 1: Create Razorpay Plan
      console.log('[Subscription] 📋 Creating Razorpay plan...');
      const planResponse = await fetch(`${backendUrl}/api/payment/subscription/create-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: `${selectedPlan.name} - ${profileCount} Profile${profileCount > 1 ? 's' : ''}`,
          amount: convertedAmount,
          currency: targetCurrency,
          interval: 'yearly',
          description: `${selectedPlan.name} subscription for ${profileCount} profile(s)`
        })
      });

      if (!planResponse.ok) {
        throw new Error('Failed to create subscription plan');
      }

      const { plan } = await planResponse.json();
      console.log('[Subscription] ✅ Plan created:', plan.id);

      // Step 2: Create Razorpay Subscription
      console.log('[Subscription] 📅 Creating subscription...');
      const subscriptionResponse = await fetch(`${backendUrl}/api/payment/subscription/create-with-mandate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName || currentUser.email,
          contact: currentUser.phoneNumber || '',
          planId: plan.razorpayPlanId,
          gbpAccountId: subscription?.gbpAccountId,
          // IMPORTANT: When coupon is applied, the plan amount is already the TOTAL (not per-profile)
          // So quantity should be 1, not profileCount, otherwise Razorpay multiplies the total by profileCount!
          profileCount: (selectedPlanId === 'per_profile_yearly' && !couponDetails) ? profileCount : 1,
          notes: {
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            actualProfileCount: profileCount, // Track actual profile count in notes
            ...(couponDetails && couponCode && {
              couponCode: couponCode,
              originalAmount: selectedPlanId === 'per_profile_yearly'
                ? SubscriptionService.calculateTotalPrice(profileCount)
                : selectedPlan.amount,
              discountAmount: couponDetails.discountAmount,
              finalAmount: couponDetails.finalAmount
            })
          }
        })
      });

      if (!subscriptionResponse.ok) {
        const errorData = await subscriptionResponse.json().catch(() => ({}));
        throw new Error(errorData.details || 'Failed to create subscription');
      }

      const { subscription: razorpaySubscription } = await subscriptionResponse.json();
      console.log('[Subscription] ✅ Subscription created:', razorpaySubscription.id);

      // Step 3: Open Razorpay Checkout for SUBSCRIPTION (with mandate authorization)
      // NOTE: Using 'as any' because RazorpayOrderOptions is for orders, not subscriptions
      // Subscriptions use different fields (subscription_id instead of order_id, no amount/currency)
      const options: any = {
        key: razorpayKeyId,
        subscription_id: razorpaySubscription.id, // SUBSCRIPTION ID instead of order_id
        name: 'LOBAISEO',
        description: `${selectedPlan.name} - Auto-pay subscription`,
        // NOTE: Do NOT send customer_id when using subscription_id - customer is already linked to subscription
        recurring: 1, // ENABLE RECURRING PAYMENTS / MANDATE
        handler: async (response) => {
          try {
            console.log('[Subscription] 💳 Payment completed, verifying...');
            // Verify subscription payment on backend
            const verifyResponse = await fetch(`${backendUrl}/api/payment/subscription/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                razorpay_subscription_id: (response as any).razorpay_subscription_id,
                razorpay_payment_id: (response as any).razorpay_payment_id,
                razorpay_signature: (response as any).razorpay_signature,
                gbpAccountId: subscription?.gbpAccountId
              })
            });

            if (verifyResponse.ok) {
              toast({
                title: "Success!",
                description: "Subscription activated with auto-pay mandate",
              });

              // Close modal
              onClose();

              // Set flag to indicate we're reloading after payment
              sessionStorage.setItem('post_payment_reload', 'true');

              // Force subscription status refresh with delay
              setTimeout(async () => {
                try {
                  await checkSubscriptionStatus();
                  window.location.reload();
                } catch (error) {
                  console.error('Failed to refresh subscription status:', error);
                  window.location.reload();
                }
              }, 2000);

              // Navigate to payment success page
              navigate('/payment-success');
            } else {
              // Get the actual error from the backend
              const errorData = await verifyResponse.json().catch(() => ({}));
              console.error('[Subscription] Verification failed:', verifyResponse.status, errorData);
              throw new Error(errorData.details || errorData.error || 'Subscription payment verification failed');
            }
          } catch (error) {
            console.error('Subscription payment handler error:', error);
            toast({
              title: "Payment Error",
              description: error.message || "There was an issue processing your subscription payment. Please try again.",
              variant: "destructive"
            });
            setIsProcessing(false);
          }
        },
        prefill: {
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          contact: currentUser.phoneNumber || ''
        },
        notes: {
          planId: selectedPlan.id,
          profileCount: selectedPlanId === 'per_profile_yearly' ? profileCount : 1
        } as any,
        theme: {
          color: '#1E2DCD',
          backdrop_color: 'rgba(0, 0, 0, 0.5)'
        },
        // Removed custom config - Razorpay Subscriptions will automatically show mandate-compatible payment methods
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast({
              title: "Subscription Setup Cancelled",
              description: "You can set up your subscription later from the dashboard.",
              variant: "default"
            });
          },
          escape: true,
          backdropclose: false,
          handleback: true,
          confirm_close: true
        }
      };

      // Create Razorpay instance for SUBSCRIPTION
      try {
        const razorpayInstance = new Razorpay(options);

        // Listen for payment failure
        razorpayInstance.on('payment.failed', function (response) {
          console.error('Subscription payment failed:', response.error);
          setIsProcessing(false);
          toast({
            title: "Subscription Setup Failed",
            description: response.error.description || "Unable to set up auto-pay. Please try again.",
            variant: "destructive"
          });
        });

        // Close the upgrade modal BEFORE opening Razorpay
        onClose();

        // Open Razorpay subscription modal
        setTimeout(() => {
          razorpayInstance.open();

          toast({
            title: "Subscription Setup",
            description: "⚠️ Choose UPI or Card to set up auto-pay mandate. You'll authorize recurring payments.",
          });
        }, 100);

      } catch (razorpayError) {
        console.error('Failed to initialize Razorpay subscription:', razorpayError);
        throw new Error('Failed to initialize subscription. Please refresh and try again.');
      }

    } catch (error) {
      console.error('Subscription setup error:', error);

      let errorMessage = "There was an error setting up your subscription. Please try again.";

      if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.message.includes('plan')) {
        errorMessage = "Failed to create subscription plan. Please try again.";
      } else if (error.message.includes('subscription')) {
        errorMessage = "Failed to create subscription. Please try again.";
      } else if (error.message.includes('Razorpay')) {
        errorMessage = "Payment gateway error. Please refresh the page and try again.";
      }

      toast({
        title: "Subscription Setup Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 flex flex-col">
        {/* Fixed Header */}
        <DialogHeader className="flex-shrink-0 bg-background z-20 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Upgrade Your Profile Access</DialogTitle>
          <DialogDescription>
            Choose how many Google Business Profiles you want to manage. Pay only for what you need at $99 per profile per year.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ minHeight: 0 }}>
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
                            ? `$${(SubscriptionService.calculateTotalPrice(profileCount) / 100).toFixed(0)}/year (₹${Math.round((SubscriptionService.calculateTotalPrice(profileCount) / 100) * exchangeRate)}/year)`
                            : `$${(plan.amount / 100).toFixed(0)}/${plan.interval === 'monthly' ? 'month' : 'year'} (₹${Math.round((plan.amount / 100) * exchangeRate)}/${plan.interval === 'monthly' ? 'month' : 'year'})`
                          }
                        </CardDescription>
                      </div>
                    </div>
                    {plan.interval === 'yearly' && (
                      <div className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm font-medium">
                        Save 80%
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
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-600" />
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
                      (₹{Math.round((SubscriptionService.calculateTotalPrice(profileCount) / 100) * exchangeRate)}/year)
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

            {/* Payment Methods Information */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    💳 Multiple Payment Options Available
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs text-blue-700">
                    <div className="flex items-center space-x-1">
                      <span>🏦</span>
                      <span>Net Banking</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>📱</span>
                      <span>UPI (GPay, PhonePe, Paytm)</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>💳</span>
                      <span>Credit/Debit Cards</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>👝</span>
                      <span>Digital Wallets</span>
                    </div>
                  </div>
                  <p className="text-sm text-blue-700 mt-2">
                    Your payment information is encrypted and secure. We support Cards, PayPal, and international payment methods via Razorpay.
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    💡 Payment is processed in INR (Indian Rupees) at live exchange rate: 1 USD = ₹{exchangeRate.toFixed(2)}
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
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 bg-background border-t px-6 py-4">
          <div className="flex items-center justify-between gap-4">
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
                  <p className="text-sm text-gray-600">
                    ₹{Math.round((getFinalAmount() / 100) * exchangeRate)}/{selectedPlan?.interval === 'monthly' ? 'month' : 'year'}
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
                  <p className="text-sm text-gray-600">
                    ₹{Math.round((getFinalAmount() / 100) * exchangeRate)}/{selectedPlan?.interval === 'monthly' ? 'month' : 'year'}
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
            <div className="flex gap-3 flex-shrink-0">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                disabled={isProcessing}
                className="min-w-[160px] bg-primary hover:bg-primary/90"
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
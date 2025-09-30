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

    if (!Razorpay) {
      toast({
        title: "Error",
        description: "Payment system is not loaded. Please refresh the page and try again.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Show loading toast
      toast({
        title: "Initializing Payment",
        description: "Please wait while we set up your payment...",
      });

      // Calculate USD amount
      const usdAmount = selectedPlanId === 'per_profile_yearly'
        ? SubscriptionService.calculateTotalPrice(profileCount)
        : selectedPlan.amount;

      // Auto-detect user's currency based on location
      console.log('[Payment] 🌍 Detecting user currency...');
      const currencyDetectionResponse = await fetch(`${backendUrl}/api/payment/detect-currency`);

      let exchangeRate = 88.78; // Fallback rate
      let targetCurrency = 'INR'; // Default fallback
      let currencySymbol = '₹';

      if (currencyDetectionResponse.ok) {
        const currencyData = await currencyDetectionResponse.json();
        targetCurrency = currencyData.detectedCurrency;
        exchangeRate = currencyData.exchangeRate || 88.78;
        currencySymbol = currencyData.currencySymbol;
        console.log(`[Payment] ✅ Detected: ${currencyData.country} → ${targetCurrency} (${currencySymbol})`);
        console.log(`[Payment] ✅ Live exchange rate: 1 USD = ${exchangeRate} ${targetCurrency}`);
      } else {
        console.warn('[Payment] ⚠️ Currency detection failed, using fallback: INR');
      }

      // Convert USD to target currency using live rate
      const usdInDollars = usdAmount / 100;
      const convertedAmount = Math.round(usdInDollars * exchangeRate * 100); // Convert to paise/cents

      console.log(`[Payment] 💱 Converting: $${usdInDollars} USD → ${convertedAmount/100} ${targetCurrency} (rate: ${exchangeRate})`);

      // Create order in backend with retry logic
      let orderResponse;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          orderResponse = await fetch(`${backendUrl}/api/payment/order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: convertedAmount,
              currency: targetCurrency,
              usdAmount: usdInDollars, // Backend will fetch live rate and convert
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

          if (orderResponse.ok) {
            break;
          } else {
            throw new Error(`HTTP ${orderResponse.status}: ${orderResponse.statusText}`);
          }
        } catch (error) {
          retryCount++;
          console.warn(`Order creation attempt ${retryCount} failed:`, error);

          if (retryCount >= maxRetries) {
            throw new Error(`Failed to create order after ${maxRetries} attempts: ${error.message}`);
          }

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (!orderResponse.ok) {
        const errorData = await orderResponse.text();
        throw new Error(`Failed to create order: ${errorData}`);
      }

      const { order, finalAmount } = await orderResponse.json();

      // Validate order data
      if (!order || !order.id || !order.amount) {
        throw new Error('Invalid order data received from server');
      }

      // Razorpay checkout options with enhanced payment methods
      const options: RazorpayOrderOptions = {
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'LOBAISEO',
        description: selectedPlan.name,
        order_id: order.id,
        timeout: 300, // 5 minutes timeout
        retry: {
          enabled: true,
          max_count: 3
        },
        handler: async (response) => {
          try {
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

              // Force subscription status refresh with delay to ensure backend is updated
              setTimeout(async () => {
                try {
                  await checkSubscriptionStatus();
                  // Force complete page reload to clear any cached states
                  window.location.reload();
                } catch (error) {
                  console.error('Failed to refresh subscription status:', error);
                  // Still reload to clear cache
                  window.location.reload();
                }
              }, 2000);

              // Navigate to payment success page
              navigate('/payment-success');
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('Payment handler error:', error);
            toast({
              title: "Payment Error",
              description: "There was an issue processing your payment. Please try again.",
              variant: "destructive"
            });
            setIsProcessing(false);
          }
        },
        prefill: {
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          contact: ''
        },
        notes: {
          address: 'LOBAISEO Corporate Office'
        },
        theme: {
          color: '#1E2DCD',
          backdrop_color: 'rgba(0, 0, 0, 0.5)'
        },
        config: {
          display: {
            blocks: {
              card: {
                name: 'Credit/Debit Cards',
                instruments: [
                  {
                    method: 'card',
                    types: ['credit', 'debit'],
                    issuers: ['VISA', 'MC', 'AMEX', 'RUPAY', 'MAES', 'BAJAJ'],
                    flows: ['3ds', 'ivr', 'otp', 'pin']
                  }
                ]
              },
              paypal: {
                name: 'PayPal',
                instruments: [
                  {
                    method: 'paypal'
                  }
                ]
              },
              intl_bank_transfer: {
                name: 'International Bank Transfer',
                instruments: [
                  {
                    method: 'bank_transfer'
                  }
                ]
              },
              utib: {
                name: 'UPI (India)',
                instruments: [
                  {
                    method: 'upi'
                  }
                ]
              },
              banks: {
                name: 'Net Banking (India)',
                instruments: [
                  {
                    method: 'netbanking',
                    banks: ['HDFC', 'ICIC', 'SBIN', 'AXIS', 'YESB', 'KKBK', 'PUNB_R']
                  }
                ]
              },
              wallet: {
                name: 'Digital Wallets',
                instruments: [
                  {
                    method: 'wallet',
                    wallets: ['paytm', 'mobikwik', 'phonepe', 'amazonpay', 'freecharge', 'jiomoney', 'paypal', 'airtelmoney', 'jiomoney']
                  }
                ]
              },
              international: {
                name: 'International Methods',
                instruments: [
                  {
                    method: 'app',
                    apps: ['gpay_int', 'paypal', 'phonepe_switch']
                  }
                ]
              }
            },
            sequence: ['block.card', 'block.paypal', 'block.international', 'block.intl_bank_transfer', 'block.utib', 'block.banks', 'block.wallet'],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast({
              title: "Payment Cancelled",
              description: "Your payment was cancelled.",
              variant: "default"
            });
          },
          escape: true,
          backdropclose: false,
          handleback: true,
          confirm_close: true,
          animation: true
        }
      };

      // Create Razorpay instance with error handling
      try {
        const razorpayInstance = new Razorpay(options);

        // Listen for payment failure
        razorpayInstance.on('payment.failed', function (response) {
          console.error('Payment failed:', response.error);
          setIsProcessing(false);
          toast({
            title: "Payment Failed",
            description: response.error.description || "Your payment could not be processed. Please try again.",
            variant: "destructive"
          });
        });

        // Open Razorpay modal
        razorpayInstance.open();

        // Show success toast for modal opening
        toast({
          title: "Payment Gateway Loaded",
          description: "Choose your preferred payment method to continue.",
        });

      } catch (razorpayError) {
        console.error('Failed to initialize Razorpay:', razorpayError);
        throw new Error('Failed to initialize payment gateway. Please refresh and try again.');
      }

    } catch (error) {
      console.error('Payment error:', error);

      let errorMessage = "There was an error processing your payment. Please try again.";

      // Provide more specific error messages
      if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.message.includes('order')) {
        errorMessage = "Failed to create payment order. Please try again.";
      } else if (error.message.includes('Razorpay')) {
        errorMessage = "Payment gateway error. Please refresh the page and try again.";
      }

      toast({
        title: "Payment Failed",
        description: errorMessage,
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
                            ? `$${(SubscriptionService.calculateTotalPrice(profileCount) / 100).toFixed(0)}/year (₹${Math.round((SubscriptionService.calculateTotalPrice(profileCount) / 100) * 83)}/year)`
                            : `$${(plan.amount / 100).toFixed(0)}/${plan.interval === 'monthly' ? 'month' : 'year'} (₹${Math.round((plan.amount / 100) * 83)}/${plan.interval === 'monthly' ? 'month' : 'year'})`
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
                      (₹{Math.round((SubscriptionService.calculateTotalPrice(profileCount) / 100) * 83)}/year)
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
                    💡 Payment is processed in INR (Indian Rupees) at current exchange rate: 1 USD = ₹83
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
                  <p className="text-sm text-gray-600">
                    ₹{Math.round((getFinalAmount() / 100) * 83)}/{selectedPlan?.interval === 'monthly' ? 'month' : 'year'}
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
                    ₹{Math.round((getFinalAmount() / 100) * 83)}/{selectedPlan?.interval === 'monthly' ? 'month' : 'year'}
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
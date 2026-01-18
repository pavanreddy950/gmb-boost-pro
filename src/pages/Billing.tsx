import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard,
  Calendar,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Receipt,
  Sparkles,
  Headphones,
  Mail,
  MessageCircle,
  Shield,
  Infinity
} from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PaymentModal } from '@/components/PaymentModal';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

const Billing = () => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const {
    subscription,
    status,
    daysRemaining,
    plans,
    cancelSubscription,
    isLoading
  } = useSubscription();

  const { currentUser } = useAuth();
  const { toast } = useToast();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdTokenResult();
          const adminStatus = token.claims.role === 'admin' || token.claims.adminLevel;
          setIsAdmin(adminStatus);
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        }
      }
    };

    checkAdminStatus();
  }, [currentUser]);

  // Fetch payment history and check for recent upgrade
  useEffect(() => {
    if (subscription?.gbpAccountId) {
      fetchPaymentHistory();
      
      // Check if recently upgraded (within last 5 minutes)
      if (subscription?.status === 'active' && subscription?.lastPaymentDate) {
        const lastPayment = new Date(subscription.lastPaymentDate);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (lastPayment > fiveMinutesAgo) {
          setShowUpgradeSuccess(true);
          // Hide the success message after 10 seconds
          setTimeout(() => setShowUpgradeSuccess(false), 10000);
        }
      }
    }
  }, [subscription]);

  const fetchPaymentHistory = async () => {
    if (!subscription?.gbpAccountId) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/payment/subscription/${subscription.gbpAccountId}/payments`
      );
      
      if (response.ok) {
        const data = await response.json();
        // Use payment history from subscription if available
        const payments = data.payments || subscription?.paymentHistory || [];
        setPaymentHistory(payments);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      // Fallback to subscription payment history if fetch fails
      if (subscription?.paymentHistory) {
        setPaymentHistory(subscription.paymentHistory);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) {
      return;
    }

    try {
      await cancelSubscription();
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive"
      });
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'trial':
        return <Badge className="bg-blue-100 text-blue-800">Free Trial</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge>No Subscription</Badge>;
    }
  };

  const currentPlan = subscription?.planId 
    ? plans.find(p => p.id === subscription.planId) 
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and payment details
        </p>
      </div>

      {/* Upgrade Success Alert */}
      {showUpgradeSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <Sparkles className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Congratulations!</strong> Your subscription has been successfully upgraded. All premium features are now unlocked!
          </AlertDescription>
        </Alert>
      )}

      {/* Current Subscription Card */}
      {isAdmin ? (
        // Admin View - Show unlimited access
        <Card className="border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-purple-600" />
              <span>Administrator Account</span>
              <Badge className="bg-purple-600">Unlimited Access</Badge>
            </CardTitle>
            <CardDescription>Full platform access with no restrictions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <Infinity className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold">Profiles</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">Unlimited</p>
                <p className="text-xs text-muted-foreground">No profile limits</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-semibold">Status</span>
                </div>
                <p className="text-2xl font-bold text-green-600">Active</p>
                <p className="text-xs text-muted-foreground">Permanent access</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">Features</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">All</p>
                <p className="text-xs text-muted-foreground">Premium access</p>
              </div>
            </div>
            <div className="bg-purple-100 rounded-lg p-4 border-l-4 border-purple-600">
              <p className="text-sm text-purple-900">
                <strong>Admin Privileges:</strong> You have full access to all features, unlimited profiles, and administrative controls. No subscription required.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : status === 'active' && subscription ? (
        // Active Subscription View - Show comprehensive billing breakdown
        <Card className="border-2 border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <span>Active Subscription</span>
              <Badge className="bg-green-600">Active</Badge>
            </CardTitle>
            <CardDescription>Your subscription is active and all features are unlocked</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Stats - Separate Boxes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200 text-center">
                <p className="text-4xl font-bold text-blue-600">{subscription.paidSlots || 0}</p>
                <p className="text-sm text-blue-700 mt-1 font-medium">Paid Slots</p>
              </div>
              <div className="bg-green-50 rounded-xl p-5 border-2 border-green-200 text-center">
                <p className="text-4xl font-bold text-green-600">{subscription.connectedProfiles || 0}</p>
                <p className="text-sm text-green-700 mt-1 font-medium">Connected</p>
              </div>
              <div className={`rounded-xl p-5 border-2 text-center ${
                (subscription.availableSlots || 0) > 0
                  ? 'bg-purple-50 border-purple-200'
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <p className={`text-4xl font-bold ${
                  (subscription.availableSlots || 0) > 0 ? 'text-purple-600' : 'text-orange-600'
                }`}>
                  {(subscription.availableSlots || 0) > 0
                    ? subscription.availableSlots
                    : Math.abs((subscription.connectedProfiles || 0) - (subscription.paidSlots || 0))
                  }
                </p>
                <p className={`text-sm mt-1 font-medium ${
                  (subscription.availableSlots || 0) > 0 ? 'text-purple-700' : 'text-orange-700'
                }`}>
                  {(subscription.availableSlots || 0) > 0 ? 'Available' : 'Need More'}
                </p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-5 border-2 border-indigo-200 text-center">
                <p className="text-4xl font-bold text-indigo-600">{daysRemaining || 0}</p>
                <p className="text-sm text-indigo-700 mt-1 font-medium">Days Left</p>
              </div>
            </div>

            {/* Warning if need more slots */}
            {subscription.needsMoreSlots && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Action Required:</strong> You have {subscription.connectedProfiles} connected profiles but only paid for {subscription.paidSlots}.
                  Please purchase {(subscription.connectedProfiles || 0) - (subscription.paidSlots || 0)} more slot(s) to continue using all features.
                </AlertDescription>
              </Alert>
            )}

            {/* Subscription Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-muted-foreground block">Amount Paid</span>
                <p className="font-semibold text-lg">₹{subscription.amountPaid || 0}</p>
              </div>
              {subscription.subscriptionStartDate && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-muted-foreground block">Started On</span>
                  <p className="font-semibold">{format(new Date(subscription.subscriptionStartDate), 'MMM dd, yyyy')}</p>
                </div>
              )}
              {subscription.subscriptionEndDate && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-muted-foreground block">Expires On</span>
                  <p className="font-semibold">{format(new Date(subscription.subscriptionEndDate), 'MMM dd, yyyy')}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-muted-foreground block">Price Per Profile</span>
                <p className="font-semibold">₹99/year</p>
              </div>
            </div>

            {/* Add More Profiles Button */}
            <div className="flex justify-center pt-2">
              <Button onClick={() => setIsPaymentModalOpen(true)} className="bg-gradient-to-r from-blue-600 to-purple-600">
                <CreditCard className="mr-2 h-4 w-4" />
                Add More Profiles
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Trial/Expired/None User View
        <Card className={status === 'trial' ? 'border-blue-500' : status === 'expired' ? 'border-red-500' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>Current Subscription</span>
              {status === 'trial' && <Clock className="h-5 w-5 text-blue-500" />}
              {status === 'expired' && <XCircle className="h-5 w-5 text-red-500" />}
            </CardTitle>
            <CardDescription>
              {status === 'trial' ? 'You are on a free trial' :
               status === 'expired' ? 'Your subscription has expired' :
               'Start your subscription today'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Trial View */}
            {status === 'trial' && (
              <>
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90 mb-1">Free Trial</p>
                      <p className="text-3xl font-bold">{daysRemaining} Days Left</p>
                      <p className="text-sm mt-2 opacity-90">
                        Full access to all features
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3 text-center">
                      <Clock className="h-8 w-8 mx-auto mb-1" />
                      <p className="text-xs opacity-90">Trial Period</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-blue-700 font-medium">Connected Profiles</p>
                    <p className="text-2xl font-bold text-blue-600">{subscription?.connectedProfiles || 0}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-green-700 font-medium">Features</p>
                    <p className="text-2xl font-bold text-green-600">All</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-sm text-purple-700 font-medium">Trial Ends</p>
                    <p className="text-lg font-bold text-purple-600">
                      {subscription?.trialEndDate ? format(new Date(subscription.trialEndDate), 'MMM dd') : 'N/A'}
                    </p>
                  </div>
                </div>

                <Alert className="bg-blue-50 border-blue-200">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Upgrade Now:</strong> Subscribe before your trial ends to keep all your profiles and settings!
                  </AlertDescription>
                </Alert>

                <div className="flex justify-center">
                  <Button onClick={() => setIsPaymentModalOpen(true)} className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Upgrade to Pro - ₹99/profile/year
                  </Button>
                </div>
              </>
            )}

            {/* Expired View */}
            {status === 'expired' && (
              <>
                <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90 mb-1">Subscription Status</p>
                      <p className="text-3xl font-bold">Expired</p>
                      <p className="text-sm mt-2 opacity-90">
                        Renew to continue using all features
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3 text-center">
                      <XCircle className="h-8 w-8 mx-auto mb-1" />
                      <p className="text-xs opacity-90">Action Required</p>
                    </div>
                  </div>
                </div>

                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Your subscription has expired.</strong> Auto-posting and other features are paused.
                    Renew now to continue managing your business profiles.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-center">
                  <Button onClick={() => setIsPaymentModalOpen(true)} className="bg-gradient-to-r from-green-600 to-emerald-600">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Renew Subscription
                  </Button>
                </div>
              </>
            )}

            {/* No Subscription View */}
            {(status === 'none' || (!status)) && (
              <>
                <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90 mb-1">No Active Subscription</p>
                      <p className="text-3xl font-bold">Get Started</p>
                      <p className="text-sm mt-2 opacity-90">
                        Start your journey with a free trial
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3 text-center">
                      <Sparkles className="h-8 w-8 mx-auto mb-1" />
                      <p className="text-xs opacity-90">15 Day Trial</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button onClick={() => setIsPaymentModalOpen(true)} className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Start Free Trial
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs for Plans and History */}
      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Available Plans</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 mt-8">
            {plans.map((plan) => (
              <div key={plan.id} className="relative pt-4">
                {currentPlan?.id === plan.id && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
                      CURRENT PLAN
                    </div>
                  </div>
                )}
                {plan.popular && currentPlan?.id !== plan.id && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
                      MOST POPULAR
                    </div>
                  </div>
                )}
                <Card className={`mt-3 ${
                  currentPlan?.id === plan.id
                    ? 'border-green-500 ring-2 ring-green-200'
                    : plan.popular
                    ? 'border-primary/50'
                    : ''
                }`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {plan.interval === 'yearly' && (
                        <Badge className="bg-green-100 text-green-800">Save 80%</Badge>
                      )}
                    </div>
                    {plan.id === 'per_profile_yearly' ? (
                      <div className="mt-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-foreground">$99</span>
                          <span className="text-xl text-muted-foreground line-through">$499</span>
                        </div>
                        <CardDescription className="mt-1">per Google Business Profile/year</CardDescription>
                      </div>
                    ) : (
                      <CardDescription className="text-2xl font-bold text-foreground mt-2">
                        ${(plan.amount / 100).toFixed(0)}/{plan.interval}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {currentPlan?.id !== plan.id && (
                      <Button
                        className="w-full mt-4"
                        onClick={() => setIsPaymentModalOpen(true)}
                      >
                        {status === 'active' ? 'Access More Profiles' : 'Get Started'}
                      </Button>
                    )}
                    
                    {currentPlan?.id === plan.id && (
                      <div className="mt-4 text-center text-sm text-muted-foreground">
                        Current Plan
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}

            {/* Support Card */}
            <Card className="bg-white border-2 border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                    <Headphones className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-gray-900 font-bold">Need Help?</CardTitle>
                    <CardDescription className="text-gray-600 mt-1">
                      We're here to assist you with any questions or concerns
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Our support team is ready to help you get the most out of your subscription. 
                  Reach out to us through any of the following channels:
                </p>
                
                <div className="space-y-3">
                  {/* Email Support */}
                  <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md">
                    <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 mb-1">Email Support</p>
                      <a 
                        href="mailto:Support@lobaiseo.com" 
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline break-all"
                      >
                        Support@lobaiseo.com
                      </a>
                    </div>
                  </div>

                  {/* WhatsApp Support */}
                  <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-green-100/50 rounded-xl border-2 border-green-200 hover:border-green-300 transition-all duration-200 hover:shadow-md">
                    <div className="h-12 w-12 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 mb-1">WhatsApp Support</p>
                      <a 
                        href="https://wa.me/917710616166" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-green-600 hover:text-green-700 font-medium hover:underline"
                      >
                        +91 7710616166
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border-l-4 border-blue-600">
                  <p className="text-xs text-gray-800 leading-relaxed">
                    <strong className="text-blue-900 font-semibold">Response Time:</strong> We typically respond within 24 hours on business days. 
                    Premium subscribers receive priority support.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Your past transactions and invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : paymentHistory.length > 0 ? (
                <div className="space-y-3">
                  {paymentHistory.map((payment, index) => (
                    <div key={payment.razorpayPaymentId || index} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex items-center space-x-3">
                        {payment.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : payment.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        )}
                        <div>
                          <p className="font-medium">₹{payment.amount}</p>
                          <p className="text-sm text-muted-foreground">
                            {payment.paidAt ? format(new Date(payment.paidAt), 'MMM dd, yyyy HH:mm') : 
                             payment.createdAt ? format(
                               new Date(
                                 typeof payment.createdAt === 'string' 
                                   ? payment.createdAt 
                                   : payment.createdAt.seconds * 1000
                               ), 
                               'MMM dd, yyyy'
                             ) : 
                             'Date not available'}
                          </p>
                          {payment.description && (
                            <p className="text-xs text-muted-foreground">{payment.description}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          payment.status === 'success' ? 'default' :
                          payment.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {payment.status}
                        </Badge>
                        {payment.razorpayPaymentId && (
                          <Button variant="ghost" size="sm">
                            <Receipt className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No payment history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Modal */}
      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />
    </div>
  );
};

export default Billing;